import React, { useState, useEffect } from 'react';
import { PostNode } from './RiffTree';

const Feed = () => {
    const [posts, setPosts] = useState([]);
    const [sort, setSort] = useState('recent');
    const [category, setCategory] = useState('All'); // <--- NEW STATE

    // Defined Categories (Match your Auto-Tag logic + General)
    const categories = [
        "All", 
        "General", 
        "Theory", 
        "Research", 
        "Support", 
        "Feature Request", 
        "Guardian Prime", 
        "Easy Bake App"
    ];

    const fetchPosts = async () => {
        try {
            // Include category in URL
            const res = await fetch(`/mice/api/community/feed?sort=${sort}&category=${encodeURIComponent(category)}`);
            const data = await res.json();
            
            if (Array.isArray(data)) {
                setPosts(data);
            } else {
                console.error("Feed Error:", data);
                setPosts([]);
            }
        } catch (e) {
            console.error("Fetch failed:", e);
            setPosts([]);
        }
    };

    // Re-fetch when Sort OR Category changes
    useEffect(() => {
        fetchPosts();
    }, [sort, category]);

    return (
        <div className="feed-container">
            
            {/* CONTROLS ROW */}
            <div className="feed-controls" style={{ 
                marginBottom: '20px', 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '15px', 
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                
                {/* 1. Sort Buttons */}
                <div className="sort-group">
                    <button 
                        onClick={() => setSort('recent')} 
                        style={{
                            marginRight:'10px', 
                            background: 'transparent', 
                            color: sort==='recent' ? '#80cbc4' : '#666',
                            border: sort==='recent' ? '1px solid #80cbc4' : '1px solid #444'
                        }}
                    >
                        Recent
                    </button>
                    <button 
                        onClick={() => setSort('likes')} 
                        style={{
                            background: 'transparent', 
                            color: sort==='likes' ? '#80cbc4' : '#666',
                            border: sort==='likes' ? '1px solid #80cbc4' : '1px solid #444'
                        }}
                    >
                        Top Rated
                    </button>
                </div>

                {/* 2. Category Filter (Dropdown for compactness on mobile) */}
                <div className="filter-group">
                    <select 
                        value={category} 
                        onChange={(e) => setCategory(e.target.value)}
                        style={{
                            padding: '8px',
                            background: '#1a1a1a',
                            color: '#fff',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            outline: 'none'
                        }}
                    >
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
            </div>
            
            {/* FEED LIST */}
            <div className="feed-list">
                {posts.map(post => (
                    <div key={post.post_id} className="feed-item">
                        <PostNode post={post} /> 
                    </div>
                ))}
                {posts.length === 0 && (
                    <p style={{color:'#666', textAlign:'center', marginTop: '50px'}}>
                        No sparks found in <strong>{category}</strong>. Be the first to ignite one.
                    </p>
                )}
            </div>
        </div>
    );
};

export default Feed;