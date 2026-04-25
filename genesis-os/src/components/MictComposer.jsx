import React, { useState, useRef, useEffect } from 'react';

const MictComposer = ({ threadId, parentId = null, onPostSuccess, authorName, initialData = null, editId = null }) => {
    // If editing, start expanded. If riffing, start expanded.
    const [isExpanded, setIsExpanded] = useState(!!parentId || !!editId);
    
    const [formData, setFormData] = useState({
        map: initialData ? initialData.m_context : '',
        iterate: initialData ? initialData.i_idea : '',
        check: initialData ? initialData.c_check : '',
        transform: initialData ? initialData.t_transform : ''
    });
    
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleSubmit = async () => {
        if (!formData.map || !formData.iterate || !formData.transform) {
            alert("Incomplete Thought.");
            return;
        }

        const token = localStorage.getItem('mice_token');
        
        // --- SWITCH LOGIC: CREATE vs UPDATE ---
        const url = editId ? `/mice/api/community/posts/${editId}` : '/mice/api/community/posts';
        const method = editId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                // For Create
                thread_id: threadId,
                parent_id: parentId,
                // For Both
                m_context: formData.map,
                i_idea: formData.iterate,
                c_check: formData.check,
                t_transform: formData.transform
            })
        });
        
        if (response.ok) {
            if (!editId) setFormData({ map: '', iterate: '', check: '', transform: '' }); // Clear only if new
            if (!parentId && !editId) setIsExpanded(false); 
            onPostSuccess();
        } else {
            alert("Action Failed");
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const uploadData = new FormData();
        uploadData.append('evidence', file);

        try {
            const res = await fetch('/mice/api/community/upload', {
                method: 'POST',
                body: uploadData
            });
            const data = await res.json();
            
            if (res.ok) {
                const existing = formData.check ? formData.check + '\n' : '';
                setFormData({ ...formData, check: existing + data.url });
            } else {
                alert("Upload failed: " + data.error);
            }
        } catch (err) {
            alert("Upload error.");
        } finally {
            setIsUploading(false);
        }
    };

    // --- COLLAPSED VIEW ---
    if (!isExpanded) {
        return (
            <div 
                className="composer-collapsed" 
                onClick={() => setIsExpanded(true)}
            >
                <span className="plus-icon">+</span>
                <span className="cta-text">Start a Spark...</span>
            </div>
        );
    }

    // --- EXPANDED VIEW ---
    return (
        <div className="composer-card">
            <div className="composer-header">
                <h3>{parentId ? "Riff on this" : "New Spark"}</h3>
                <button 
                    className="close-btn" 
                    onClick={() => setIsExpanded(false)}
                    title="Close"
                >
                    ✕
                </button>
            </div>
            
            <div className="input-group">
                <label className="label-map">[M] MAP (Context):</label>
                <textarea 
                    value={formData.map}
                    onChange={(e) => setFormData({...formData, map: e.target.value})}
                    placeholder="What is the current situation?"
                    rows="2"
                />
            </div>

            <div className="input-group">
                <label className="label-iterate">[I] ITERATE (Idea):</label>
                <textarea 
                    value={formData.iterate}
                    onChange={(e) => setFormData({...formData, iterate: e.target.value})}
                    placeholder="What is your thought?"
                    rows="3"
                />
            </div>

            <div className="input-group">
                <label className="label-check">[C] CHECK (Support):</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                        value={formData.check}
                        onChange={(e) => setFormData({...formData, check: e.target.value})}
                        placeholder="Link to source, image, or data..."
                        style={{ flex: 1 }}
                    />
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        style={{ display: 'none' }} 
                        onChange={handleFileChange}
                        accept="image/*,application/pdf"
                    />
                    <button 
                        onClick={() => fileInputRef.current.click()} 
                        className="upload-btn"
                        disabled={isUploading}
                    >
                        {isUploading ? "..." : "📎"}
                    </button>
                </div>
            </div>

            <div className="input-group">
                <label className="label-transform">[T] TRANSFORM (Action):</label>
                <textarea 
                    value={formData.transform}
                    onChange={(e) => setFormData({...formData, transform: e.target.value})}
                    placeholder="What should be done?"
                    rows="2"
                />
            </div>

            <div className="composer-actions">
                <button onClick={handleSubmit} className="btn-primary">
                    {editId ? "Refine Spark" : "Post Spark"}
                </button>
            </div>
        </div>
    );
};

export default MictComposer;