const express = require('express');
const { Firestore } = require('@google-cloud/firestore');
const geminiService = require('../services/geminiService');
const videoProcessor = require('../services/videoProcessor');
const videoAnalysisService = require('../services/videoAnalysisService');
const path = require('path');
const fs = require('fs');
const { Storage } = require('@google-cloud/storage');

const router = express.Router();

// Initialize Google Cloud services with error handling
let firestore;
let gcsStorage;
let bucket;
let useMockMode = false;

try {
  if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_PROJECT_ID !== 'your_project_id') {
    firestore = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
    gcsStorage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
    if (process.env.GOOGLE_CLOUD_STORAGE_BUCKET && process.env.GOOGLE_CLOUD_STORAGE_BUCKET !== 'your_bucket_name') {
      bucket = gcsStorage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET);
    } else {
      useMockMode = true;
    }
  } else {
    useMockMode = true;
  }
} catch (error) {
  useMockMode = true;
  console.log('Google Cloud not configured, using local file storage for development');
}

// Use shared mock storage
const { mockProjects } = require('../utils/mockStorage');

router.post('/', async (req, res) => {
  try {
    const { projectId, userPrompt, userId } = req.body;

    if (!projectId || !userPrompt) {
      return res.status(400).json({ error: 'Project ID and user prompt are required' });
    }

    console.log('Edit request for project:', projectId);
    console.log('Available projects in mock storage:', Array.from(mockProjects.keys()));

    let project;
    
    // Get project from mock storage or Firestore
    if (useMockMode || !firestore) {
      // Get project from mock storage
      project = mockProjects.get(projectId);
      if (!project) {
        console.error('Project not found in mock storage. Available IDs:', Array.from(mockProjects.keys()));
        return res.status(404).json({ 
          error: 'Project not found',
          debug: {
            requestedId: projectId,
            availableIds: Array.from(mockProjects.keys())
          }
        });
      }
      console.log('Found project:', project.projectId, 'Status:', project.status);

      // Update project status
      project.status = 'processing';
      project.lastEditPrompt = userPrompt;
      project.updatedAt = new Date();
      mockProjects.set(projectId, project);

      // Analyze video content for intelligent editing
      let videoAnalysis = null;
      try {
        // Support both YouTube downloads (localVideoPath) and direct uploads (filePath/fileName)
        let inputPath;

        if (project.processedPath && fs.existsSync(project.processedPath)) {
          inputPath = project.processedPath;
        } else if (project.localVideoPath && fs.existsSync(project.localVideoPath)) {
          inputPath = project.localVideoPath; // YouTube download
        } else if (project.filePath && fs.existsSync(project.filePath)) {
          inputPath = project.filePath; // Direct upload
        } else if (project.fileName) {
          inputPath = path.join(__dirname, '../uploads', project.fileName); // Fallback
        }

        if (inputPath && fs.existsSync(inputPath)) {
          console.log('Analyzing video content for intelligent editing...', inputPath);
          videoAnalysis = await videoAnalysisService.analyzeVideo(inputPath, userPrompt);
          console.log('Video analysis:', JSON.stringify(videoAnalysis, null, 2));
        } else {
          console.warn('Video file not found for editing');
        }
      } catch (analysisError) {
        console.warn('Video analysis failed, continuing without analysis:', analysisError);
        // Continue without analysis - not critical
      }

      // Parse editing command with video context
      const instructions = await geminiService.parseEditingCommand(
        userPrompt, 
        project.transcript || null,
        videoAnalysis
      );

      // Process video using FFmpeg
      try {
        console.log('Starting video processing for project:', projectId);
        console.log('Instructions:', JSON.stringify(instructions, null, 2));
        
        // Use processed video if available, otherwise use original
        let inputPath;
        if (project.processedPath && fs.existsSync(project.processedPath)) {
          inputPath = project.processedPath;
          console.log('Using processed video as input:', inputPath);
        } else if (project.localVideoPath && fs.existsSync(project.localVideoPath)) {
          inputPath = project.localVideoPath; // YouTube download
          console.log('Using YouTube video as input:', inputPath);
        } else if (project.filePath && fs.existsSync(project.filePath)) {
          inputPath = project.filePath; // Direct upload
          console.log('Using uploaded video as input:', inputPath);
        } else if (project.fileName) {
          inputPath = path.join(__dirname, '../uploads', project.fileName); // Fallback
          console.log('Using original video as input:', inputPath);
        }

        // Check if input file exists
        if (!inputPath || !fs.existsSync(inputPath)) {
          console.error('Input file not found:', inputPath);
          return res.status(404).json({ error: 'Video file not found: ' + inputPath });
        }

        // Use shorter filename to avoid Windows path length issues
        const timestamp = Date.now();
        const shortId = projectId.substring(0, 8);
        const tempOutputPath = path.join(__dirname, '../processed', `proc-${shortId}-${timestamp}.mp4`);
        console.log('Output path:', tempOutputPath);
        
        // Ensure processed directory exists
        const processedDir = path.join(__dirname, '../processed');
        if (!fs.existsSync(processedDir)) {
          fs.mkdirSync(processedDir, { recursive: true });
          console.log('Created processed directory:', processedDir);
        }
        
        // Verify the output path is valid and writable
        try {
          const testFile = path.join(processedDir, 'test-write.tmp');
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          console.log('Directory is writable');
        } catch (writeError) {
          console.error('Directory is not writable:', writeError);
          return res.status(500).json({ 
            error: 'Cannot write to processed directory', 
            details: writeError.message 
          });
        }

        // Process video with instructions
        // Only pass aspectRatio if user explicitly requested resize
        const hasResizeInstruction = instructions.some(i => i.action === 'resize');
        const options = hasResizeInstruction ? {} : {}; // Don't force aspect ratio unless explicitly requested
        
        console.log('Starting FFmpeg processing...');
        await videoProcessor.processVideo(
          projectId,
          instructions,
          inputPath,
          tempOutputPath,
          options
        );
        console.log('FFmpeg processing completed');

        // Add captions if requested
        let finalOutputPath = tempOutputPath;
        const hasCaptionInstruction = instructions.some(i => i.action === 'add_captions');
        if (hasCaptionInstruction) {
          if (!project.transcript) {
            console.warn('Caption requested but no transcript available');
            // Continue without captions
          } else {
            try {
              // Use shorter filename to avoid Windows path length issues
              const timestamp = Date.now();
              const shortId = projectId.substring(0, 8);
              const captionedPath = path.join(__dirname, '../processed', `cap-${shortId}-${timestamp}.mp4`);
              
              // Ensure directory exists
              const processedDir = path.dirname(captionedPath);
              if (!fs.existsSync(processedDir)) {
                fs.mkdirSync(processedDir, { recursive: true });
              }
              
              console.log('Adding captions, output path:', captionedPath);
              await videoProcessor.addCaptions(
                tempOutputPath,
                project.transcript,
                captionedPath,
                'dynamic'
              );
              finalOutputPath = captionedPath;
              console.log('Captions added successfully');
            } catch (captionError) {
              console.error('Error adding captions:', captionError);
              console.error('Caption error details:', captionError.message);
              console.error('Caption error stack:', captionError.stack);
              // Continue with video without captions rather than failing completely
              console.log('Continuing without captions due to error');
              // Don't rethrow - just use the video without captions
            }
          }
        }

        // Create public URL for processed video
        const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
        const processedFileName = path.basename(finalOutputPath);
        const processedUrl = `${backendUrl}/processed/${processedFileName}`;

        // Update project with processed video info
        project.status = 'completed';
        project.processedUrl = processedUrl;
        project.processedPath = finalOutputPath;
        project.instructions = instructions;
        project.updatedAt = new Date();
        mockProjects.set(projectId, project);
        
        console.log('Project saved after edit. Project ID:', projectId);
        console.log('Project status:', project.status);
        console.log('All projects in storage:', Array.from(mockProjects.keys()));

        res.json({
          success: true,
          projectId,
          processedUrl,
          instructions,
          message: 'Video edited successfully',
        });
      } catch (error) {
        console.error('Video processing error:', error);
        console.error('Error stack:', error.stack);
        project.status = 'error';
        project.error = error.message;
        mockProjects.set(projectId, project);
        res.status(500).json({ 
          error: 'Failed to process video', 
          details: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
      return;
    }

    // Get project from Firestore
    const projectDoc = await firestore.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    project = projectDoc.data();

    // Update project status
    await firestore.collection('projects').doc(projectId).update({
      status: 'processing',
      lastEditPrompt: userPrompt,
      updatedAt: new Date(),
    });

    // Parse editing command using Gemini
    const instructions = await geminiService.parseEditingCommand(
      userPrompt,
      project.transcript
    );

    // Download video from GCS to local temp file
    const tempInputPath = path.join(__dirname, '../temp', `input-${projectId}.mp4`);
    await bucket.file(project.gcsPath).download({ destination: tempInputPath });

    // Process video
    const tempOutputPath = path.join(__dirname, '../temp', `output-${projectId}.mp4`);
    await videoProcessor.processVideo(
      projectId,
      instructions,
      tempInputPath,
      tempOutputPath,
      { aspectRatio: '9:16' }
    );

    // Add captions if requested
    let finalOutputPath = tempOutputPath;
    const hasCaptionInstruction = instructions.some(i => i.action === 'add_captions');
    if (hasCaptionInstruction && project.transcript) {
      // Use shorter filename to avoid Windows path length issues
      const timestamp = Date.now();
      const shortId = projectId.substring(0, 8);
      const captionedPath = path.join(__dirname, '../temp', `cap-${shortId}-${timestamp}.mp4`);
      
      // Ensure directory exists
      const tempDir = path.dirname(captionedPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      await videoProcessor.addCaptions(
        tempOutputPath,
        project.transcript,
        captionedPath,
        'dynamic'
      );
      finalOutputPath = captionedPath;
    }

    // Upload processed video to GCS
    const processedGcsPath = `processed/${userId || 'anonymous'}/${projectId}/final.mp4`;
    await bucket.upload(finalOutputPath, {
      destination: processedGcsPath,
      metadata: {
        contentType: 'video/mp4',
      },
    });

    const processedUrl = `https://storage.googleapis.com/${bucket.name}/${processedGcsPath}`;

    // Update project with processed video info
    await firestore.collection('projects').doc(projectId).update({
      status: 'completed',
      processedGcsPath,
      processedUrl,
      instructions,
      updatedAt: new Date(),
    });

    // Clean up temp files
    [tempInputPath, tempOutputPath, finalOutputPath].forEach(file => {
      if (fs.existsSync(file) && file !== tempOutputPath) {
        fs.unlinkSync(file);
      }
    });

    res.json({
      success: true,
      projectId,
      processedUrl,
      instructions,
      message: 'Video edited successfully',
    });
  } catch (error) {
    console.error('Edit error:', error);
    res.status(500).json({ error: 'Failed to process video edit', details: error.message });
  }
});

module.exports = router;

