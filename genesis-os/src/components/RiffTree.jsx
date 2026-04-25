import React, { useState } from 'react';
import MictComposer from './MictComposer';

// Exporting PostNode in case we need it elsewhere later
export const PostNode = ({ post }) => {
    const [showComposer, setShowComposer] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    if (!post) return null;

    // 1. Identify User
    const currentUser = JSON.parse(localStorage.getItem('mice_user') || '{}');
    // Check if the viewer owns this post
    const isOwner = currentUser.user_id === post.user_id;
    const isAdmin = currentUser.role === 'admin';
    
    // Admins can Delete, but usually only Owners should Edit text (to preserve voice)
    // Unless you want Admins to edit too, use separate flags:
    const canEdit = isOwner; 
    const canDelete = isOwner || isAdmin;

    // 2. Delete Logic
    const handleDelete = async () => {
        if (!window.confirm("Are you sure you want to extinguish this Spark?")) return;
        
        const token = localStorage.getItem('mice_token');
        try {
            const res = await fetch(`/mice/api/community/posts/${post.post_id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
                // Simple refresh to clear the post from view
                window.location.reload();
            } else {
                alert("Failed to delete. You might not have permission.");
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Dates for display
    const created = new Date(post.created_at);
    // Handle cases where updated_at might be null/missing
    const updated = post.updated_at ? new Date(post.updated_at) : created;
    const isEdited = updated > new Date(created.getTime() + 5000);

    // --- EDIT MODE VIEW ---
    if (isEditing) {
        return (
            <div className="riff-node" style={{ borderLeft: '3px solid #ffb74d' }}>
                <MictComposer 
                    editId={post.post_id}
                    initialData={post}
                    onPostSuccess={() => window.location.reload()} 
                />
                <button 
                    onClick={() => setIsEditing(false)} 
                    style={{ marginTop: '5px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}
                >
                    Cancel Edit
                </button>
            </div>
        );
    }
        const [votes, setVotes] = useState(post.upvotes || 0);
        const [hasVoted, setHasVoted] = useState(false); // Session-based anti-spam

        const handleLike = async () => {
            if (hasVoted) return; // Prevent spamming in one session
        
        const token = localStorage.getItem('mice_token');
            if (!token) return alert("Please login to vote.");

        // Optimistic UI update
        setVotes(v => v + 1);
        setHasVoted(true);

        try {
            await fetch(`/mice/api/community/posts/${post.post_id}/like`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (e) {
            console.error("Vote failed");
            setVotes(v => v - 1); // Rollback if server fails
            setHasVoted(false);
        }
        };
    // --- STANDARD VIEW ---
    return (
        <div className="riff-node">
            <div className="post-content">
                
                {/* HEADER */}
                <div className="header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div>
                        <span className="author" style={{ fontWeight: 'bold', color: '#80cbc4' }}>
                            {post.author_name || "Anonymous"}
                        </span>
                        
                        <span className="meta" style={{ marginLeft: '10px', fontSize: '0.8em', color: '#666' }}>
                            {created.toLocaleDateString()}
                        </span>
                        
                        {isEdited && (
                            <span style={{ marginLeft: '8px', fontSize: '0.7em', color: '#ffb74d', fontStyle: 'italic' }}>
                                (Updated)
                            </span>
                        )}
                        
                        {post.status && post.status !== 'open' && (
                            <span className={`status-badge status-${post.status}`} style={{
                                marginLeft: '10px', fontSize: '0.7em', padding: '2px 6px',
                                borderRadius: '4px', color: '#fff',
                                backgroundColor: post.status === 'resolved' ? '#2e7d32' : '#424242'
                            }}>
                                {post.status.toUpperCase()}
                            </span>
                        )}
                        
                        {post.category && (
                             <span style={{ marginLeft: '10px', fontSize: '0.7em', color: '#aaa', border: '1px solid #444', padding: '1px 4px', borderRadius: '3px'}}>
                                {post.category}
                             </span>
                        )}
                    </div>
                </div>
                
                {/* MICT CONTENT */}
                <div className="mict-body" style={{ marginTop: '10px' }}>
                    <div className="section map"><strong>[M] Map:</strong> {post.m_context}</div>
                    <div className="section iterate"><strong>[I] Iterate:</strong> {post.i_idea}</div>
                    
                    {post.c_check && (
                        <div className="section check">
                            <strong>[C] Check:</strong> 
                            {post.c_check.startsWith('http') || post.c_check.startsWith('/') ? (
                                <a href={post.c_check} target="_blank" rel="noopener noreferrer" style={{color: '#81c784', marginLeft: '5px'}}>
                                    View Evidence
                                </a>
                            ) : (
                                <span style={{marginLeft: '5px'}}>{post.c_check}</span>
                            )}
                        </div>
                    )}
                    
                    <div className="section transform"><strong>[T] Transform:</strong> {post.t_transform}</div>
                </div>

                {/* ACTIONS BAR */}
                <div className="actions" style={{ marginTop: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    
                    {/* 1. VOTE BUTTON (New) */}
                    <button 
                        onClick={handleLike}
                        disabled={hasVoted}
                        style={{ 
                            fontSize: '0.8em', padding: '5px 10px', 
                            background: hasVoted ? '#80cbc4' : '#333', 
                            color: hasVoted ? '#000' : '#80cbc4', 
                            border: '1px solid #80cbc4', 
                            cursor: hasVoted ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '5px'
                        }}
                        title="Resonate with this idea"
                    >
                        <span>⚡</span>
                        <strong>{votes}</strong>
                    </button>

                    {/* 2. RIFF BUTTON */}
                    <button 
                        onClick={() => setShowComposer(!showComposer)}
                        style={{ fontSize: '0.8em', padding: '5px 10px', background: '#333', border: '1px solid #555', color: '#ddd', cursor: 'pointer' }}
                    >
                        {showComposer ? "Cancel Riff" : "Riff on This"}
                    </button>

                    {/* Edit Button (Owner Only) */}
                    {canEdit && (
                        <button 
                            onClick={() => setIsEditing(true)}
                            style={{ fontSize: '0.8em', padding: '5px 10px', background: '#0d47a1', border: '1px solid #1565c0', color: '#fff', cursor: 'pointer' }}
                        >
                            Edit
                        </button>
                    )}
                    
                    {/* Delete Button (Owner OR Admin) */}
                    {canDelete && (
                        <button 
                            onClick={handleDelete} 
                            style={{ fontSize: '0.8em', padding: '5px 10px', background: '#b71c1c', border: '1px solid #d32f2f', color: '#fff', cursor: 'pointer' }}
                        >
                            Delete
                        </button>
                    )}
                </div>
                
                {/* RIFF COMPOSER */}
                {showComposer && (
                    <div style={{ marginLeft: '20px', marginTop: '10px', borderLeft: '2px solid #555', paddingLeft: '10px' }}>
                        <MictComposer 
                            threadId={post.thread_id} 
                            parentId={post.post_id} 
                            onPostSuccess={() => window.location.reload()} 
                        />
                    </div>
                )}
            </div>

            {/* CHILDREN RECURSION */}
            {post.children && post.children.length > 0 && (
                <div className="children-container">
                    {post.children.map(child => (
                        <PostNode key={child.post_id} post={child} />
                    ))}
                </div>
            )}
        </div>
    );
};

const RiffTree = ({ posts = [] }) => {
    // Safety check for undefined posts
    if (!posts || !Array.isArray(posts)) return null;

    const buildTree = (flatPosts) => {
        const map = {};
        const roots = [];
        // Deep copy to avoid mutation issues
        const postsCopy = flatPosts.map(p => ({ ...p, children: [] }));
        
        postsCopy.forEach(post => { map[post.post_id] = post; });
        postsCopy.forEach(post => {
            if (post.parent_id && map[post.parent_id]) {
                map[post.parent_id].children.push(post);
            } else {
                roots.push(post);
            }
        });
        return roots;
    };

    const tree = (posts.length > 0 && posts[0].children) ? posts : buildTree(posts);

    return (
        <div className="riff-tree">
            {tree.map(root => (
                <PostNode key={root.post_id} post={root} />
            ))}
        </div>
    );
};

export default RiffTree;