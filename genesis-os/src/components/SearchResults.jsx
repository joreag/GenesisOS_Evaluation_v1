import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PostNode } from './RiffTree';

const SearchResults = () => {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (!query) return;

        const performSearch = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/mice/api/community/search?q=${encodeURIComponent(query)}`);
                const data = await res.json();
                
                if (Array.isArray(data)) {
                    setResults(data);
                } else {
                    setResults([]);
                }
            } catch (error) {
                console.error("Search failed:", error);
            } finally {
                setLoading(false);
            }
        };

        performSearch();
    }, [query]);

    // Helper to render different result types
    const renderResult = (item) => {
        // CASE A: It's a Post (Has MICT fields)
        if (item.m_context) {
            return (
                <div key={`post-${item.post_id}`} style={{ marginBottom: '20px' }}>
                    <PostNode post={item} />
                </div>
            );
        }
        
        // CASE B: It's a User (Has discipline field but no m_context)
        if (item.discipline) {
            return (
                <div key={`user-${item.user_id}`} className="riff-node" style={{ 
                    padding: '15px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    borderLeft: '3px solid #7c43bd' // Purple for Users
                }}>
                    <div>
                        <h3 style={{ margin: '0 0 5px 0', color: '#e0e0e0' }}>{item.name}</h3>
                        <span className="discipline-tag">{item.discipline}</span>
                    </div>
                    {/* Placeholder for future "Follow" or "View Profile" */}
                    <button 
                        style={{ background: '#333', border: '1px solid #555', color: '#ccc', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                        onClick={() => alert("User Profile View coming in v0.2")}
                    >
                        View Profile
                    </button>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="search-page">
            <header style={{ marginBottom: '30px' }}>
                <h2 style={{ color: '#80cbc4' }}>
                    Search Results <span style={{ fontSize: '0.6em', color: '#666' }}>// {query}</span>
                </h2>
                <button 
                    onClick={() => navigate('/')}
                    style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: 0 }}
                >
                    ← Back to Feed
                </button>
            </header>

            {loading ? (
                <p style={{ color: '#666', textAlign: 'center' }}>Scanning Cognitive Graph...</p>
            ) : (
                <div className="results-list">
                    {results.length > 0 ? (
                        results.map(item => renderResult(item))
                    ) : (
                        <div style={{ textAlign: 'center', color: '#666', marginTop: '50px' }}>
                            <p>No sparks found matching pattern: "{query}"</p>
                            <p style={{ fontSize: '0.8em' }}>Try searching for a #category or @user.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchResults;