const { GoogleGenerativeAI } = require('@google/generative-ai');
const videoAnalysisService = require('./videoAnalysisService');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      // Use gemini-2.5-flash (modern, generally available version)
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }
  }

  async parseEditingCommand(userPrompt, transcript = null, videoAnalysis = null) {
    try {
      // Re-check API key in case it was set after constructor
      if (!this.apiKey) {
        this.apiKey = process.env.GEMINI_API_KEY;
        if (this.apiKey && !this.genAI) {
          this.genAI = new GoogleGenerativeAI(this.apiKey);
          this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        }
      }

      if (!this.apiKey) {
        console.log('Gemini API key not found, using mock instructions');
        // Return mock response for development
        return this.getMockEditingInstructions(userPrompt, videoAnalysis);
      }

      console.log('Using Gemini API for intelligent command parsing');

      // Build context from video analysis
      let videoContext = '';
      if (videoAnalysis && videoAnalysis.scenes) {
        videoContext = '\n\nVideo Content Analysis:\n';
        videoContext += `Summary: ${videoAnalysis.summary || 'N/A'}\n\n`;
        videoContext += 'Key Scenes:\n';
        videoAnalysis.scenes.slice(0, 5).forEach(scene => {
          videoContext += `- ${scene.timestamp.toFixed(1)}s: ${scene.description}`;
          if (scene.objects && scene.objects.length > 0) {
            videoContext += ` (Objects: ${scene.objects.join(', ')})`;
          }
          if (scene.actions && scene.actions.length > 0) {
            videoContext += ` (Actions: ${scene.actions.join(', ')})`;
          }
          videoContext += '\n';
        });
        
        if (videoAnalysis.keyMoments && videoAnalysis.keyMoments.length > 0) {
          videoContext += '\nKey Moments:\n';
          videoAnalysis.keyMoments.forEach(moment => {
            videoContext += `- ${moment.timestamp.toFixed(1)}s: ${moment.description}\n`;
          });
        }
      }

      const systemInstruction = `You are an expert video editor. Convert the user's natural language request into a precise, step-by-step set of technical editing instructions.

CRITICAL: You MUST always output at least one instruction. Never return an empty array.

${videoContext ? `IMPORTANT - Video Analysis Available:
The video has been analyzed and you have access to scene descriptions with timestamps. When the user says things like:
- "when she shows makeup" → Find the timestamp in the video analysis where makeup/palette appears
- "when X happens" → Find the timestamp where X is described in the scenes
- "zoom on Y" → Find when Y appears and use that timestamp

Use the timestamps from the video analysis scenes to create temporal edits (e.g., zoom with start/end times).
If multiple scenes match, use the first or most relevant one.` : ''}

Reference the provided transcript's timestamps if the user mentions specific words, phrases, or time ranges.

Output ONLY a valid JSON array of editing instructions. Each instruction should have:
- action: one of ["trim", "cut", "speed_change", "add_captions", "resize", "apply_filter", "remove_silence", "zoom"]
- parameters: object with specific parameters for that action

For zoom actions with temporal requirements:
- If user says "zoom when X" or "zoom on X", you MUST include start and end times
- Use the timestamp from video analysis where X appears
- Set start time slightly before (e.g., timestamp - 0.5s) and end time slightly after (e.g., timestamp + 2s)
- Include factor (default 1.5) and target/position (default "center")

Example formats:

Example 1 - Temporal zoom (when content appears):
[
  {
    "action": "zoom",
    "parameters": {
      "start": "0:02",
      "end": "0:05",
      "factor": 1.5,
      "target": "center"
    }
  }
]

Example 2 - Basic edits:
[
  {
    "action": "trim",
    "parameters": {
      "start": "0:00",
      "end": "0:30"
    }
  },
  {
    "action": "add_captions",
    "parameters": {
      "style": "dynamic",
      "position": "bottom"
    }
  },
  {
    "action": "speed_change",
    "parameters": {
      "factor": 2
    }
  }
]

REMEMBER: Always return at least one instruction. If the user wants zoom "when X appears", find X in the video analysis and create a zoom instruction with start/end times.`;

      let prompt = systemInstruction + '\n\nUser Request: ' + userPrompt;
      
      if (transcript) {
        prompt += '\n\nTranscript (with timestamps):\n';
        if (transcript.words && transcript.words.length > 0) {
          const transcriptText = transcript.words
            .map(w => `[${w.startTime.toFixed(2)}s] ${w.word}`)
            .join(' ');
          prompt += transcriptText;
        } else {
          prompt += transcript.text || '';
        }
      }

      // Add video analysis context to help with temporal understanding
      if (videoAnalysis && videoAnalysis.scenes) {
        prompt += '\n\nCRITICAL INSTRUCTIONS:';
        prompt += '\n1. The video analysis above shows WHEN things appear in the video.';
        prompt += '\n2. If the user says "zoom when she shows makeup" or "zoom on makeup", you MUST:';
        prompt += '\n   - Find the scene(s) that mention "makeup" or "palette" in the video analysis';
        prompt += '\n   - Use the timestamp from that scene';
        prompt += '\n   - Create a zoom instruction with start and end times around that timestamp';
        prompt += '\n   - Example: If makeup appears at 2.7s, create zoom from 2.2s to 4.7s';
        prompt += '\n3. ALWAYS return at least one instruction - never return an empty array.';
        prompt += '\n4. If you cannot find exact content, use the first key moment or relevant scene.';
      }

      console.log('Sending prompt to Gemini with video context...');
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log('Gemini raw response:', text.substring(0, 500)); // Log first 500 chars

      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const instructions = JSON.parse(jsonMatch[0]);
          if (Array.isArray(instructions) && instructions.length > 0) {
            console.log('Successfully parsed instructions:', instructions.length);
            return instructions;
          } else {
            console.warn('Gemini returned empty instructions array, using fallback');
            // Fallback: use video analysis to create instruction
            return this.createInstructionFromVideoAnalysis(userPrompt, videoAnalysis);
          }
        } catch (parseError) {
          console.error('Error parsing Gemini JSON:', parseError);
          return this.createInstructionFromVideoAnalysis(userPrompt, videoAnalysis);
        }
      }

      // Fallback: try to parse the entire response
      try {
        const instructions = JSON.parse(text);
        if (Array.isArray(instructions) && instructions.length > 0) {
          return instructions;
        }
      } catch (e) {
        console.error('Failed to parse Gemini response, using fallback');
      }

      // Final fallback: create instruction from video analysis
      return this.createInstructionFromVideoAnalysis(userPrompt, videoAnalysis);
    } catch (error) {
      console.error('Gemini API error:', error);
      console.error('Error details:', error.message);
      // Try to create instruction from video analysis as fallback
      if (videoAnalysis) {
        const fallbackInstructions = this.createInstructionFromVideoAnalysis(userPrompt, videoAnalysis);
        if (fallbackInstructions.length > 0) {
          console.log('Using video analysis fallback after Gemini error');
          return fallbackInstructions;
        }
      }
      // Return mock response on error
      return this.getMockEditingInstructions(userPrompt, videoAnalysis);
    }
  }

  createInstructionFromVideoAnalysis(userPrompt, videoAnalysis) {
    // Fallback: create instruction directly from video analysis when Gemini fails
    const lowerPrompt = userPrompt.toLowerCase();
    const instructions = [];

    if (videoAnalysis && (lowerPrompt.includes('zoom') || lowerPrompt.includes('zoom on') || lowerPrompt.includes('zoom when'))) {
      // Find relevant content in video analysis
      const searchTerms = ['makeup', 'palette', 'product', 'show', 'demonstrate', 'present'];
      let foundTimestamp = null;
      let foundDescription = '';

      for (const term of searchTerms) {
        if (lowerPrompt.includes(term)) {
          // Search in scenes
          for (const scene of videoAnalysis.scenes || []) {
            const sceneText = `${scene.description} ${scene.objects?.join(' ') || ''}`.toLowerCase();
            if (sceneText.includes(term)) {
              foundTimestamp = scene.timestamp;
              foundDescription = scene.description;
              console.log(`Found ${term} in scene at ${foundTimestamp}s: ${foundDescription}`);
              break;
            }
          }
          
          // Also check key moments
          if (!foundTimestamp && videoAnalysis.keyMoments) {
            for (const moment of videoAnalysis.keyMoments) {
              if (moment.description.toLowerCase().includes(term)) {
                foundTimestamp = moment.timestamp;
                foundDescription = moment.description;
                console.log(`Found ${term} in key moment at ${foundTimestamp}s: ${foundDescription}`);
                break;
              }
            }
          }
          
          if (foundTimestamp) break;
        }
      }

      // If still not found, use first key moment or first scene with relevant content
      if (!foundTimestamp) {
        if (videoAnalysis.keyMoments && videoAnalysis.keyMoments.length > 0) {
          foundTimestamp = videoAnalysis.keyMoments[0].timestamp;
          foundDescription = videoAnalysis.keyMoments[0].description;
          console.log(`Using first key moment at ${foundTimestamp}s`);
        } else if (videoAnalysis.scenes && videoAnalysis.scenes.length > 0) {
          foundTimestamp = videoAnalysis.scenes[0].timestamp;
          foundDescription = videoAnalysis.scenes[0].description;
          console.log(`Using first scene at ${foundTimestamp}s`);
        }
      }

      if (foundTimestamp !== null) {
        const zoomFactor = lowerPrompt.match(/zoom.*?(\d+(?:\.\d+)?)x/i) 
          ? parseFloat(lowerPrompt.match(/zoom.*?(\d+(?:\.\d+)?)x/i)[1]) 
          : 1.5;
        
        // Create time range around the found timestamp
        const startTime = Math.max(0, foundTimestamp - 0.5);
        const endTime = foundTimestamp + 2.5;
        
        instructions.push({
          action: 'zoom',
          parameters: {
            start: this.secondsToTime(startTime),
            end: this.secondsToTime(endTime),
            factor: zoomFactor,
            target: 'center',
          },
        });
        
        console.log(`Created zoom instruction from video analysis: ${startTime}s to ${endTime}s`);
        return instructions;
      }
    }

    // If no video analysis match, return empty (will trigger default behavior)
    return [];
  }

  secondsToTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getMockEditingInstructions(userPrompt, videoAnalysis = null) {
    // Mock response for development/testing
    const lowerPrompt = userPrompt.toLowerCase();
    const instructions = [];

    // Use video analysis to find timestamps for content-based edits
    if (videoAnalysis) {
      // Check if user wants to edit at a specific moment
      if (lowerPrompt.includes('when') || lowerPrompt.includes('zoom on') || lowerPrompt.includes('zoom when')) {
        // Try to find relevant content in video analysis
        const searchTerms = ['makeup', 'product', 'show', 'demonstrate', 'reveal'];
        let foundTimestamp = null;
        
        for (const term of searchTerms) {
          if (lowerPrompt.includes(term)) {
            const matches = videoAnalysisService.findContentTimestamps(videoAnalysis, term);
            if (matches.length > 0) {
              foundTimestamp = matches[0].timestamp;
              console.log(`Found ${term} at timestamp: ${foundTimestamp}s`);
              break;
            }
          }
        }

        // If we found a timestamp and user wants zoom, create temporal zoom
        if (foundTimestamp && (lowerPrompt.includes('zoom') || lowerPrompt.includes('zoom on'))) {
          // For now, apply zoom to the whole video, but we could implement temporal zoom later
          const zoomMatch = lowerPrompt.match(/zoom.*?(\d+(?:\.\d+)?)x/i);
          const zoomFactor = zoomMatch ? parseFloat(zoomMatch[1]) : 1.5;
          
          instructions.push({
            action: 'zoom',
            parameters: {
              factor: zoomFactor,
              position: 'center',
              startTime: foundTimestamp - 1, // Start 1 second before
              endTime: foundTimestamp + 3,   // End 3 seconds after
            },
          });
          
          // Don't add default instructions if we found a specific edit
          return instructions;
        }
      }
    }

    // Detect trim/cut commands
    if (lowerPrompt.includes('cut') || lowerPrompt.includes('trim')) {
      const timeMatch = lowerPrompt.match(/(\d+):(\d+)/);
      if (timeMatch) {
        instructions.push({
          action: 'trim',
          parameters: {
            start: '0:00',
            end: `${timeMatch[1]}:${timeMatch[2]}`,
          },
        });
      } else {
        instructions.push({
          action: 'trim',
          parameters: {
            start: '0:00',
            end: '0:30',
          },
        });
      }
    }

    // Detect speed commands
    if (lowerPrompt.includes('speed') || lowerPrompt.includes('faster')) {
      const speedMatch = lowerPrompt.match(/(\d+)x/);
      instructions.push({
        action: 'speed_change',
        parameters: {
          factor: speedMatch ? parseInt(speedMatch[1]) : 2,
        },
      });
    }

    // Detect caption commands
    if (lowerPrompt.includes('caption') || lowerPrompt.includes('subtitle')) {
      instructions.push({
        action: 'add_captions',
        parameters: {
          style: 'dynamic',
          position: 'bottom',
        },
      });
    }

    // Detect zoom commands
    if (lowerPrompt.includes('zoom') || lowerPrompt.includes('zoom in') || lowerPrompt.includes('zoom on')) {
      // Try to detect zoom factor (e.g., "zoom 2x", "zoom in 1.5x")
      const zoomMatch = lowerPrompt.match(/zoom.*?(\d+(?:\.\d+)?)x/i);
      const zoomFactor = zoomMatch ? parseFloat(zoomMatch[1]) : 1.5; // Default 1.5x zoom
      
      // Try to detect position (center, left, right, top, bottom, or specific object)
      let position = 'center';
      if (lowerPrompt.includes('left')) position = 'left';
      else if (lowerPrompt.includes('right')) position = 'right';
      else if (lowerPrompt.includes('top')) position = 'top';
      else if (lowerPrompt.includes('bottom')) position = 'bottom';
      else if (lowerPrompt.includes('center') || lowerPrompt.includes('middle')) position = 'center';
      
      instructions.push({
        action: 'zoom',
        parameters: {
          factor: zoomFactor,
          position: position,
        },
      });
    }

    // Detect resize commands (but not if zoom was already detected)
    if (!lowerPrompt.includes('zoom') && (lowerPrompt.includes('resize') || lowerPrompt.includes('9:16') || lowerPrompt.includes('16:9') || lowerPrompt.includes('aspect'))) {
      const aspectMatch = lowerPrompt.match(/(\d+):(\d+)/);
      instructions.push({
        action: 'resize',
        parameters: {
          aspectRatio: aspectMatch ? `${aspectMatch[1]}:${aspectMatch[2]}` : '9:16',
        },
      });
    }

    // Detect filter/style commands
    if (lowerPrompt.includes('cinematic') || lowerPrompt.includes('filter') || lowerPrompt.includes('style')) {
      instructions.push({
        action: 'apply_filter',
        parameters: {
          filter: 'cinematic',
        },
      });
    }

    // Default: add captions and resize to 9:16 (only if no instructions were added)
    if (instructions.length === 0) {
      instructions.push(
        {
          action: 'resize',
          parameters: {
            aspectRatio: '9:16',
          },
        },
        {
          action: 'add_captions',
          parameters: {
            style: 'dynamic',
            position: 'bottom',
          },
        }
      );
    }

    return instructions;
  }
}

module.exports = new GeminiService();

