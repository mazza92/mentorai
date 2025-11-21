const { AssemblyAI } = require('assemblyai');
const fs = require('fs');

// Initialize AssemblyAI
let assemblyai;
let useAssemblyAI = false;

if (process.env.ASSEMBLYAI_API_KEY && process.env.ASSEMBLYAI_API_KEY !== 'your_assemblyai_api_key_here') {
  try {
    assemblyai = new AssemblyAI({
      apiKey: process.env.ASSEMBLYAI_API_KEY,
    });
    useAssemblyAI = true;
    console.log('✅ TranscriptionService: AssemblyAI initialized');
  } catch (error) {
    console.error('❌ TranscriptionService: AssemblyAI initialization failed:', error.message);
  }
}

/**
 * Transcribe audio file using AssemblyAI
 * @param {string} audioFilePath - Path to audio file
 * @param {string} service - Transcription service to use ('assemblyai' is recommended)
 * @returns {Promise<Object>} Transcript with text and word-level timestamps
 */
async function transcribe(audioFilePath, service = 'assemblyai') {
  if (!fs.existsSync(audioFilePath)) {
    throw new Error(`Audio file not found: ${audioFilePath}`);
  }

  if (service === 'assemblyai' && useAssemblyAI) {
    console.log(`[TranscriptionService] Using AssemblyAI for: ${audioFilePath}`);

    try {
      // Upload and transcribe
      const transcript = await assemblyai.transcripts.transcribe({
        audio: audioFilePath,
        speech_model: 'best',
        language_detection: true,
      });

      if (transcript.status === 'error') {
        throw new Error(transcript.error);
      }

      console.log(`[TranscriptionService] ✓ Complete: ${transcript.text.length} chars`);

      return {
        success: true,
        transcript: {
          text: transcript.text,
          words: (transcript.words || []).map(w => ({
            word: w.text,
            startTime: w.start / 1000, // Convert ms to seconds
            endTime: w.end / 1000,
            confidence: w.confidence,
          })),
          segments: [],
        }
      };
    } catch (error) {
      console.error(`[TranscriptionService] AssemblyAI error:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  throw new Error('AssemblyAI not configured. Set ASSEMBLYAI_API_KEY environment variable.');
}

module.exports = {
  transcribe
};
