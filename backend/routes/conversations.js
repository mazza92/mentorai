const express = require('express');
const { Firestore } = require('@google-cloud/firestore');

const router = express.Router();

// Initialize Firestore with error handling
let firestore;
let useMockMode = false;

try {
  if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_PROJECT_ID !== 'your_project_id') {
    const firestoreConfig = {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    };

    // Handle credentials from Railway environment variable
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        firestoreConfig.credentials = credentials;
      } catch (error) {
        console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON for conversations');
        throw error;
      }
    }

    firestore = new Firestore(firestoreConfig);
  } else {
    useMockMode = true;
    console.log('Using mock conversation storage for development');
  }
} catch (error) {
  useMockMode = true;
  console.log('Firestore not configured, using mock conversation storage for development');
  console.log('Error:', error.message);
}

// Use shared mock storage for conversations
const { mockConversations } = require('../utils/mockStorage');

// Get all conversations for a user
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (useMockMode || !firestore) {
      const conversations = Array.from(mockConversations.values())
        .filter(c => c.userId === userId)
        .map(c => ({
          ...c,
          createdAt: c.createdAt?.toISOString?.() || c.createdAt,
          updatedAt: c.updatedAt?.toISOString?.() || c.updatedAt,
          messages: c.messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp?.toISOString?.() || msg.timestamp
          }))
        }));
      return res.json({ conversations });
    }
    
    const conversationsRef = firestore.collection('conversations');
    const snapshot = await conversationsRef.where('userId', '==', userId).get();

    if (snapshot.empty) {
      return res.json({ conversations: [] });
    }

    const conversations = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      conversations.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        messages: (data.messages || []).map(msg => ({
          ...msg,
          timestamp: msg.timestamp?.toDate?.()?.toISOString() || msg.timestamp
        }))
      });
    });

    // Sort by updatedAt (most recent first)
    conversations.sort((a, b) => {
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      return bTime - aTime;
    });

    res.json({ conversations });
  } catch (error) {
    // Fallback to mock mode
    if (error.code === 'ENOTFOUND' || error.message.includes('credentials')) {
      const { userId } = req.params;
      const conversations = Array.from(mockConversations.values())
        .filter(c => c.userId === userId)
        .map(c => ({
          ...c,
          createdAt: c.createdAt?.toISOString?.() || c.createdAt,
          updatedAt: c.updatedAt?.toISOString?.() || c.updatedAt,
          messages: c.messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp?.toISOString?.() || msg.timestamp
          }))
        }));
      return res.json({ conversations });
    }
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations', details: error.message });
  }
});

// Save a conversation
router.post('/', async (req, res) => {
  try {
    const { userId, conversation } = req.body;
    
    if (!userId || !conversation) {
      return res.status(400).json({ error: 'User ID and conversation are required' });
    }

    if (useMockMode || !firestore) {
      // Store in mock storage
      const convData = {
        ...conversation,
        userId,
        createdAt: conversation.createdAt ? new Date(conversation.createdAt) : new Date(),
        updatedAt: conversation.updatedAt ? new Date(conversation.updatedAt) : new Date(),
        messages: (conversation.messages || []).map(msg => ({
          ...msg,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
        }))
      };
      mockConversations.set(conversation.id, convData);
      return res.json({ success: true, conversation: convData });
    }
    
    // Save to Firestore
    const conversationRef = firestore.collection('conversations').doc(conversation.id);
    const conversationData = {
      ...conversation,
      userId,
      createdAt: conversation.createdAt ? new Date(conversation.createdAt) : new Date(),
      updatedAt: conversation.updatedAt ? new Date(conversation.updatedAt) : new Date(),
      messages: (conversation.messages || []).map(msg => ({
        ...msg,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
      }))
    };
    
    await conversationRef.set(conversationData, { merge: true });
    
    res.json({ success: true, conversation: conversationData });
  } catch (error) {
    console.error('Error saving conversation:', error);
    res.status(500).json({ error: 'Failed to save conversation', details: error.message });
  }
});

// Delete a conversation
router.delete('/:userId/:conversationId', async (req, res) => {
  try {
    const { userId, conversationId } = req.params;
    
    if (useMockMode || !firestore) {
      // Delete from mock storage
      const conv = mockConversations.get(conversationId);
      if (conv && conv.userId === userId) {
        mockConversations.delete(conversationId);
        return res.json({ success: true });
      }
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Delete from Firestore
    const conversationRef = firestore.collection('conversations').doc(conversationId);
    const conversationDoc = await conversationRef.get();
    
    if (!conversationDoc.exists) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const conversationData = conversationDoc.data();
    if (conversationData.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    await conversationRef.delete();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation', details: error.message });
  }
});

module.exports = router;

