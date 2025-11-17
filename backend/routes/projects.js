const express = require('express');
const { Firestore } = require('@google-cloud/firestore');

const router = express.Router();

// Use shared mock storage
const { mockProjects } = require('../utils/mockStorage');

// Initialize Firestore with error handling
let firestore;
let useMockMode = false;

try {
  if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_PROJECT_ID !== 'your_project_id') {
    firestore = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
  } else {
    useMockMode = true;
    console.log('Using mock project storage for development');
  }
} catch (error) {
  useMockMode = true;
  console.log('Firestore not configured, using mock project storage for development');
}

// Get all projects for a user
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (useMockMode || !firestore) {
      const projects = Array.from(mockProjects.values()).filter(p => p.userId === userId);
      return res.json({ projects });
    }
    
    const projectsRef = firestore.collection('projects');
    const snapshot = await projectsRef.where('userId', '==', userId).get();

    if (snapshot.empty) {
      return res.json({ projects: [] });
    }

    const projects = [];
    snapshot.forEach((doc) => {
      projects.push({ id: doc.id, ...doc.data() });
    });

    res.json({ projects });
  } catch (error) {
    // Fallback to mock mode
    if (error.code === 'ENOTFOUND' || error.message.includes('credentials')) {
      const { userId } = req.params;
      const projects = Array.from(mockProjects.values()).filter(p => p.userId === userId);
      return res.json({ projects });
    }
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects', details: error.message });
  }
});

// Get single project
router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    if (useMockMode || !firestore) {
      // Debug: always log what's in storage
      const allProjectIds = Array.from(mockProjects.keys());
      console.log('GET /api/projects/project/:projectId');
      console.log('Requested project ID:', projectId);
      console.log('Total projects in storage:', mockProjects.size);
      console.log('Available project IDs:', allProjectIds);
      
      const project = mockProjects.get(projectId);
      if (!project) {
        console.log('Project not found in mock storage');
        return res.status(404).json({ 
          error: 'Project not found',
          debug: {
            requestedId: projectId,
            availableIds: allProjectIds,
            totalProjects: mockProjects.size
          }
        });
      }
      console.log('Project found:', projectId, 'Status:', project.status || 'unknown');
      console.log('Project thumbnail:', project.thumbnail);
      console.log('Project title:', project.title || project.name || 'N/A');
      return res.json({ project: { id: projectId, ...project } });
    }
    
    const projectDoc = await firestore.collection('projects').doc(projectId).get();

    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project: { id: projectDoc.id, ...projectDoc.data() } });
  } catch (error) {
    // Fallback to mock mode
    if (error.code === 'ENOTFOUND' || error.message.includes('credentials')) {
      const { projectId } = req.params;
      const project = mockProjects.get(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      return res.json({ project: { id: projectId, ...project } });
    }
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project', details: error.message });
  }
});

module.exports = router;

