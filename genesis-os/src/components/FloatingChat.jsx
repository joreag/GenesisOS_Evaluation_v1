import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { api as axios } from '../utils/api';

const styles = {
    container: { position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
    bubble: { width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#00796b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', fontSize: '30px', transition: 'transform 0.2s', position: 'relative' },
    window: { width: '350px', height: '500px', backgroundColor: '#1e1e1e', border: '1px solid #333', borderRadius: '12px', marginBottom: '15px', display: 'flex', flexDirection: 'column', boxShadow: '0 5px 20px rgba(0,0,0,0.5)', overflow: 'hidden' },
    header: { padding: '15px', backgroundColor: '#2d2d2d', borderBottom: '1px solid #333', fontWeight: 'bold', color: '#80cbc4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    body: { flex: 1, padding: '0', overflowY: 'auto', display: 'flex', flexDirection: 'column', backgroundColor: '#121212' },
    footer: { padding: '10px', borderTop: '1px solid #333', backgroundColor: '#2d2d2d' },
    input: { width: '100%', padding: '10px', borderRadius: '20px', border: '1px solid #444', backgroundColor: '#000', color: 'white', outline: 'none' },
    msgRow: { display: 'flex', marginBottom: '10px', padding: '0 15px', position: 'relative' }, // Added relative
    msgBubble: { maxWidth: '80%', padding: '8px 12px', borderRadius: '12px', fontSize: '0.9rem', lineHeight: '1.4', position: 'relative', cursor: 'default' },
    contactRow: { padding: '15px', borderBottom: '1px solid #333', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.2s', position: 'relative' },
    avatar: { width: '35px', height: '35px', borderRadius: '50%', backgroundColor: '#444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem', position: 'relative' },
    contactName: { fontWeight: 'bold', color: '#e0e0e0', fontSize: '0.95rem' },
    contactRole: { fontSize: '0.75rem', color: '#888' },
    backBtn: { cursor: 'pointer', marginRight: '10px', color: '#888', fontSize: '1.2em' },
    onlineDot: { width: '10px', height: '10px', backgroundColor: '#4caf50', borderRadius: '50%', position: 'absolute', bottom: '0', right: '0', border: '2px solid #1e1e1e' },
    unreadBadge: { backgroundColor: '#ff5252', color: 'white', borderRadius: '10px', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold', position: 'absolute', right: '15px' },
    totalBadge: { position: 'absolute', top: '-5px', right: '-5px', backgroundColor: '#ff5252', color: 'white', borderRadius: '50%', width: '20px', height: '20px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #121212' },
    
    // ACTION OVERLAY
    promoteBtn: { position: 'absolute', top: '-10px', right: '-10px', background: '#333', border: '1px solid #555', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer', zIndex: 10 }
};

const FloatingChat = ({ user }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState('list');
    const [contacts, setContacts] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null); 
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [onlineUserIds, setOnlineUserIds] = useState(new Set()); 
    const [socket, setSocket] = useState(null);
    const [hoverMsgId, setHoverMsgId] = useState(null); // Track hover state
    const scrollRef = useRef();
    const activeConvoRef = useRef(null);

    useEffect(() => { activeConvoRef.current = activeConversation ? activeConversation.id : null; }, [activeConversation]);

    const fetchDirectory = async () => {
        try {
            const token = localStorage.getItem('mice_token');
            const res = await axios.get('https://boredbrains.net/mice/api/users/directory', { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) setContacts(res.data.data);
        } catch (e) { console.error("Directory fail"); }
    };

    useEffect(() => { if (isOpen && view === 'list') fetchDirectory(); }, [isOpen, view]);

    // Socket Setup (Stable Polling)
    useEffect(() => {
        if (!user) return;
        const token = localStorage.getItem('mice_token');
        if (!token) return;

        const newSocket = io('https://boredbrains.net', { 
            path: '/mice/socket.io',
            auth: { token },
            transports: ['polling'], 
            upgrade: false, 
            secure: true, rejectUnauthorized: false
        });

        newSocket.on('presence_update', (ids) => setOnlineUserIds(new Set(ids)));
        newSocket.on('receive_message', (msg) => {
            if (activeConvoRef.current && msg.conversation_id == activeConvoRef.current) {
                setMessages(prev => [...prev, msg]);
            } else { fetchDirectory(); }
        });

        setSocket(newSocket);
        return () => newSocket.disconnect();
    }, [user]); 

    // Load History
    useEffect(() => {
        if (activeConversation && socket) {
            socket.emit('join_room', `room_${activeConversation.id}`);
            const token = localStorage.getItem('mice_token');
            axios.get(`https://boredbrains.net/mice/api/chat/${activeConversation.id}/history`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => { if(res.data.success) setMessages(res.data.data); });
        }
    }, [activeConversation, socket]);

    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, view]);

    const handleSendAction = (e) => {
        if (e.key !== 'Enter') return;
        const content = input.trim();
        if (!content || !socket) return;
        socket.emit('send_message', { conversationId: activeConversation.id, content: content });
        setInput("");
    };

    const handleSelectContact = async (contact) => {
        try {
            const token = localStorage.getItem('mice_token');
            const res = await axios.post('https://boredbrains.net/mice/api/chat/start', { targetUserId: contact.id }, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) {
                setActiveConversation({ id: res.data.conversationId, name: contact.name });
                setView('chat');
            }
        } catch (e) {}
    };

    // --- PROMOTE TO LAB LOGIC ---
    const handlePromote = async (msg) => {
        if (!window.confirm("Promote this context to The Lab?")) return;
        try {
            const token = localStorage.getItem('mice_token');
            const res = await axios.post('https://boredbrains.net/mice/api/research/promote', {
                messageContent: msg.content,
                senderName: msg.sender_name || "Unknown"
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            if (res.data.success) alert("Context captured in Lab.");
        } catch (e) { alert("Failed to promote."); }
    };

    if (!user) return null;
    const totalUnread = contacts.reduce((sum, c) => sum + (c.unread_count || 0), 0);

    return (
        <div style={styles.container}>
            {isOpen && (
                <div style={styles.window}>
                    <div style={styles.header}>
                        <div style={{display:'flex', alignItems:'center'}}>
                            {view === 'chat' && <span style={styles.backBtn} onClick={() => { setView('list'); setMessages([]); }}>&larr;</span>}
                            <span>{view === 'chat' ? activeConversation?.name : 'Secure Directory'}</span>
                        </div>
                        <span onClick={() => setIsOpen(false)} style={{cursor:'pointer', color:'#888'}}>✕</span>
                    </div>
                    
                    {view === 'list' && (
                        <div style={styles.body}>
                            {contacts.map(c => (
                                <div key={c.id} style={styles.contactRow} onClick={() => handleSelectContact(c)}>
                                    <div style={styles.avatar}>{c.name.charAt(0)}{onlineUserIds.has(c.id) && <div style={styles.onlineDot}></div>}</div>
                                    <div style={{flex:1}}><div style={styles.contactName}>{c.name}</div><div style={styles.contactRole}>{c.discipline}</div></div>
                                    {c.unread_count > 0 && <div style={styles.unreadBadge}>{c.unread_count}</div>}
                                </div>
                            ))}
                        </div>
                    )}

                    {view === 'chat' && (
                        <div style={{...styles.body, padding:'15px'}} ref={scrollRef}>
                            {messages.map((msg, i) => {
                                const isMe = msg.sender_id === (user.user_id || user.id);
                                return (
                                    <div key={i} style={{...styles.msgRow, justifyContent: isMe ? 'flex-end' : 'flex-start'}}
                                         onMouseEnter={() => setHoverMsgId(i)} onMouseLeave={() => setHoverMsgId(null)}>
                                        <div style={{
                                            ...styles.msgBubble,
                                            backgroundColor: isMe ? '#00695c' : '#263238',
                                            color: '#e0e0e0',
                                            borderBottomRightRadius: isMe ? '2px' : '12px',
                                            borderBottomLeftRadius: isMe ? '12px' : '2px'
                                        }}>
                                            {!isMe && <div style={{fontSize:'0.7em', color:'#80cbc4', marginBottom:'2px'}}>{msg.sender_name}</div>}
                                            {msg.content}
                                            
                                            {/* PROMOTE BUTTON (Visible on Hover) */}
                                            {hoverMsgId === i && (
                                                <div style={styles.promoteBtn} onClick={(e) => { e.stopPropagation(); handlePromote(msg); }} title="Promote to Lab">
                                                    ⚗️
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {view === 'chat' && (
                        <div style={styles.footer}>
                            <input style={styles.input} placeholder="Secure message..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleSendAction} autoFocus />
                        </div>
                    )}
                </div>
            )}
            <div style={styles.bubble} onClick={() => setIsOpen(!isOpen)}>{isOpen ? '✕' : '💬'}{!isOpen && totalUnread > 0 && <div style={styles.totalBadge}>{totalUnread}</div>}</div>
        </div>
    );
};

export default FloatingChat;
