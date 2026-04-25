import React, { useState, useEffect } from 'react';
import { api as axios } from '../utils/api';

const TaskEditModal = ({ isOpen, onClose, task, onSave }) => {
    // Local state for form fields
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'medium',
        estimated_hours: 0,
        assignee_id: '' // In a real app, populate from project members
    });
    const [loading, setLoading] = useState(false);

    // Load task data when modal opens
    useEffect(() => {
        if (task) {
            setFormData({
                title: task.title || '',
                description: task.description || '',
                priority: task.priority || 'medium',
                estimated_hours: task.estimated_hours || 0,
                assignee_id: task.assignee_id || ''
            });
        }
    }, [task]);

    if (!isOpen || !task) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = localStorage.getItem('mice_token');
            // Call the new Backend Endpoint
            await axios.put(`/api/projects/tasks/${task.id}`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            onSave(); // Trigger parent refresh
            onClose();
        } catch (err) {
            alert("Failed to update task.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b">
                    <div>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Editing Task #{task.id}</span>
                        <h2 className="text-xl font-bold text-gray-800">Edit Details</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Task Title</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.title}
                            onChange={e => setFormData({...formData, title: e.target.value})}
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea 
                            rows="5"
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.description}
                            onChange={e => setFormData({...formData, description: e.target.value})}
                            placeholder="Add details, acceptance criteria, or context..."
                        ></textarea>
                    </div>

                    {/* Meta Grid */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                            <select 
                                className="w-full p-2 border border-gray-300 rounded"
                                value={formData.priority}
                                onChange={e => setFormData({...formData, priority: e.target.value})}
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Hours</label>
                            <input 
                                type="number" 
                                step="0.5"
                                className="w-full p-2 border border-gray-300 rounded"
                                value={formData.estimated_hours}
                                onChange={e => setFormData({...formData, estimated_hours: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TaskEditModal;
