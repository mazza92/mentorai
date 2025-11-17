const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class VideoProcessor {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../uploads');
    this.processedDir = path.join(__dirname, '../processed');
    this.tempDir = path.join(__dirname, '../temp');
  }

  // --- NEW HELPER FUNCTION: Pass 1 executes temporal filters (Zoom, Color) ---
  async executeTemporalFilters(inputPath, tempPath, videoFilters, audioFilters) {
    return new Promise((resolve, reject) => {
      console.log("PASS 1: Applying temporal and visual filters...");
      let command = ffmpeg(path.resolve(inputPath));

      if (videoFilters.length > 0) {
        // IMPORTANT: Pass filters as a concatenated string to ensure correct ordering in the graph
        command.videoFilters(videoFilters.join(','));
      }
      if (audioFilters.length > 0) {
        command.audioFilters(audioFilters.join(','));
      }

      // We must explicitly map the video and audio streams for the intermediate output
      // to ensure FFmpeg includes audio and knows which stream to use.
      command
        .outputOptions('-y')
        .outputOptions('-map', '0:v')
        .outputOptions('-map', '0:a')
        .outputOptions('-c:v', 'libx264')
        .outputOptions('-crf', '23')
        .outputOptions('-preset', 'veryfast')
        .outputOptions('-c:a', 'copy')
        .output(path.resolve(tempPath))
        .on('start', (commandLine) => {
          console.log('FFmpeg Pass 1 Command:', commandLine);
        })
        .on('end', () => {
          console.log('Pass 1 (Temporal Filters) completed.');
          resolve();
        })
        .on('error', (err, stdout, stderr) => {
          console.error('FFmpeg Pass 1 Error:', err.message);
          console.error('FFmpeg Pass 1 Stderr:', stderr);
          // Pass the error back to the main pipeline catch block
          reject(new Error(`Pass 1 (Temporal Filters) failed: ${err.message}`));
        })
        .run();
    });
  }

  // --- NEW HELPER FUNCTION: Pass 2 executes final resizing/cropping ---
  async executeFinalVerticalization(tempPath, outputPath) {
    return new Promise((resolve, reject) => {
      console.log("PASS 2: Applying final 9:16 verticalization...");
      const finalResizeFilter = 'scale=-1:1920,crop=1080:1920:(iw-1080)/2:0';

      ffmpeg(path.resolve(tempPath))
        .videoFilters(finalResizeFilter)
        .outputOptions('-y')
        .outputOptions('-c:v', 'libx264')
        .outputOptions('-crf', '23')
        .outputOptions('-preset', 'veryfast')
        .outputOptions('-c:a', 'copy') // Copy audio from temp file
        .output(path.resolve(outputPath))
        .on('start', (commandLine) => {
          console.log('FFmpeg Pass 2 Command:', commandLine);
        })
        .on('end', () => {
          console.log('Pass 2 (Verticalization) completed.');
          resolve();
        })
        .on('error', (err, stdout, stderr) => {
          console.error('FFmpeg Pass 2 Error:', err.message);
          console.error('FFmpeg Pass 2 Stderr:', stderr);
          reject(new Error(`Pass 2 (Verticalization) failed: ${err.message}`));
        })
        .run();
    });
  }

  async processVideo(projectId, instructions, inputPath, outputPath, options = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        const ffmpegInputPath = path.resolve(inputPath);
        const ffmpegOutputPath = path.resolve(outputPath);
        const tempFilePath = path.join(this.tempDir, `${uuidv4()}_temp.mp4`); // Temp file for Pass 1 output

        // Check and set up directories
        const outputDir = path.dirname(ffmpegOutputPath);
        if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir, { recursive: true });
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        let videoFilters = [];
        let audioFilters = [];

        // --- 1. PRE-PROCESSING (Trim/Cut) ---
        let currentInput = ffmpegInputPath;
        let currentOutput = tempFilePath; // Default output for Pass 1

        // Handling Trim/Cut separately as it affects the input stream
        const trimInstruction = instructions.find(i => i.action === 'trim' || i.action === 'cut');
        if (trimInstruction) {
          const start = this.timeToSeconds(trimInstruction.parameters.start || '0:00');
          const end = this.timeToSeconds(trimInstruction.parameters.end);
          const duration = end - start;

          // Perform simple trim first if needed, otherwise start from raw input
          if (start > 0 || duration > 0) {
            const trimmedPath = path.join(this.tempDir, `${uuidv4()}_trimmed.mp4`);
            await new Promise((res, rej) => {
              ffmpeg(ffmpegInputPath)
                .seekInput(start)
                .duration(duration)
                .output(path.resolve(trimmedPath))
                .on('end', () => res())
                .on('error', (err) => {
                  console.error('FFmpeg Trim Error:', err);
                  rej(new Error('Trim operation failed.'));
                })
                .run();
            });
            currentInput = trimmedPath;
          }
        }

        // --- 2. COLLECT FILTERS FOR PASS 1 ---
        instructions.forEach((instruction) => {
          // If the instruction is a video filter or affects audio, collect it.
          if (instruction.action === 'zoom' || instruction.action === 'apply_filter') {
            const filterString = this.getFilterString(instruction);
            if (filterString) videoFilters.push(filterString);
          } else if (instruction.action === 'speed_change' || instruction.action === 'remove_silence') {
            const filterString = this.getFilterString(instruction);
            if (filterString) audioFilters.push(filterString);
          }
        });

        try {
          // --- 3. EXECUTE PASS 1: Zoom and Visual Filters ---
          if (videoFilters.length > 0 || audioFilters.length > 0) {
            await this.executeTemporalFilters(currentInput, tempFilePath, videoFilters, audioFilters);
            currentInput = tempFilePath; // Pass the temp output to the next stage
          } else {
            // No filters applied, just rename/copy the input file for Pass 2
            fs.copyFileSync(currentInput, tempFilePath);
          }

          // --- 4. EXECUTE PASS 2: Final Verticalization (9:16) ---
          // This applies the scale/crop only to the output of Pass 1
          await this.executeFinalVerticalization(tempFilePath, ffmpegOutputPath);

          // --- 5. CLEANUP ---
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
          if (trimInstruction && currentInput !== ffmpegInputPath && fs.existsSync(currentInput)) {
            fs.unlinkSync(currentInput);
          }

          console.log('Video processing successfully completed.');
          resolve(outputPath);
        } catch (err) {
          console.error('Pipeline Error:', err);
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
          if (trimInstruction && currentInput !== ffmpegInputPath && fs.existsSync(currentInput)) {
            fs.unlinkSync(currentInput);
          }
          reject(err);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Helper function to return the video filter STRING for a given instruction.
   * CRITICAL: Using aggressive quoting in this pass to bypass shell/FFmpeg parsing error.
   */
  getFilterString(instruction) {
    const { action, parameters } = instruction;

    switch (action) {
      case 'zoom':
        const zoomFactor = parameters.factor || 1.5;
        const hasTemporalZoom = parameters.start && parameters.end;

        if (hasTemporalZoom) {
          const startTimeSeconds = this.timeToSeconds(parameters.start);
          const endTimeSeconds = this.timeToSeconds(parameters.end);

          if (isNaN(startTimeSeconds) || isNaN(endTimeSeconds)) {
            console.error(`Invalid time values: start=${parameters.start}, end=${parameters.end}`);
            return null;
          }

          // CRITICAL FIX: Use explicit quoting around the entire Z expression.
          // This forces the Z parameter to be treated as a single literal string by the shell/FFmpeg parser.
          const zoomCondition = `if(between(t,${startTimeSeconds},${endTimeSeconds}),${zoomFactor},1)`;

          const xFilter = 'iw/2-(iw/zoom/2)';
          const yFilter = 'ih/2-(ih/zoom/2)';

          // Note: We quote the full zoompan string, as this is the raw filter input.
          // fluent-ffmpeg typically passes this string directly after -filter:v.
          return `zoompan=z='${zoomCondition}':x='${xFilter}':y='${yFilter}':d=1`;
        } else {
          return null;
        }

      case 'speed_change':
        // Audio is handled directly in processVideo. This returns video filter.
        const factor = parameters.factor || 1;
        return `setpts=${1 / factor}*PTS`;

      case 'apply_filter':
        const filterName = parameters.filter || 'cinematic';
        const selected = this.getVisualFilterOptions(filterName);

        // Return eq filter options as a string
        return `eq=contrast=${selected.contrast}:brightness=${selected.brightness}:saturation=${selected.saturation}`;

      case 'remove_silence':
        // Audio filter is handled directly in processVideo.
        const silenceDuration = parameters.duration || 2;
        return `silenceremove=stop_periods=-1:stop_duration=${silenceDuration}:stop_threshold=-50dB`;

      default:
        return null;
    }
  }

  getVisualFilterOptions(filterName) {
    // Return options object for eq filter
    const filters = {
      cinematic: { contrast: 1.1, brightness: 0.05, saturation: 1.1 },
      travel: { contrast: 1.15, brightness: 0.1, saturation: 1.2 },
      vibrant: { contrast: 1.2, brightness: 0.05, saturation: 1.3 },
      moody: { contrast: 1.1, brightness: -0.1, saturation: 0.9 },
    };
    return filters[filterName] || filters.cinematic;
  }

  applyInstruction(command, instruction) {
    const { action, parameters } = instruction;

    switch (action) {
      case 'trim':
      case 'cut':
        const start = this.timeToSeconds(parameters.start || '0:00');
        const end = this.timeToSeconds(parameters.end);
        const duration = end - start;
        return command
          .seekInput(start)
          .duration(duration);

      case 'speed_change':
        const factor = parameters.factor || 1;
        // atempo only supports values between 0.5 and 2.0
        // For values > 2.0, we need to chain multiple atempo filters
        let audioFilter = '';
        if (factor <= 2.0) {
          audioFilter = `atempo=${factor}`;
        } else {
          // Chain multiple atempo filters for speeds > 2x
          const numFilters = Math.ceil(Math.log2(factor));
          const tempoPerFilter = Math.pow(factor, 1 / numFilters);
          audioFilter = Array(numFilters).fill(`atempo=${tempoPerFilter}`).join(',');
        }
        return command
          .videoFilters(`setpts=${1 / factor}*PTS`)
          .audioFilters(audioFilter);

      case 'zoom':
        // This is now handled by getFilterString
        return command;

      case 'resize':
        // This is now handled in Pass 2
        return command;

      case 'apply_filter':
        // This is now handled by getFilterString
        return command;

      case 'add_captions':
        return command;

      case 'remove_silence':
        const silenceDuration = parameters.duration || 2;
        return command.audioFilters(`silenceremove=stop_periods=-1:stop_duration=${silenceDuration}:stop_threshold=-50dB`);

      default:
        return command;
    }
  }

  async addCaptions(videoPath, transcript, outputPath, style = 'dynamic') {
    return new Promise((resolve, reject) => {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log('Created output directory:', outputDir);
      }

      // Normalize the output path for Windows
      outputPath = path.normalize(outputPath);
      console.log('Normalized output path:', outputPath);

      // Create SRT subtitle file
      const srtPath = path.join(this.tempDir, `${uuidv4()}.srt`);
      const srtContent = this.generateSRT(transcript, style);

      // Check if SRT content is valid
      if (!srtContent || srtContent.trim().length === 0) {
        console.warn('No SRT content generated, skipping captions');
        // Just copy the video without captions
        fs.copyFileSync(videoPath, outputPath);
        return resolve(outputPath);
      }

      // Ensure temp directory exists
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }

      try {
        fs.writeFileSync(srtPath, srtContent, 'utf8');
        console.log('SRT file created:', srtPath);
      } catch (err) {
        console.error('Error writing SRT file:', err);
        return reject(new Error('Failed to create subtitle file: ' + err.message));
      }

      // Use subtitles filter with SRT file
      // Parse SRT to verify it's valid (optional check)
      const subtitleEntries = this.parseSRT(srtContent);

      if (subtitleEntries.length === 0) {
        console.warn('No subtitle entries found in SRT file');
        // Just copy the video without captions
        fs.copyFileSync(videoPath, outputPath);
        return resolve(outputPath);
      }

      // Use subtitles filter with proper Windows path escaping
      // On Windows, convert backslashes to forward slashes and wrap the path in single quotes
      let escapedSrtPath = srtPath;
      if (process.platform === 'win32') {
        escapedSrtPath = srtPath.replace(/\\/g, '/');
        // Escape colons in the path (but not the drive letter colon)
        // Windows paths need special handling for FFmpeg
        escapedSrtPath = escapedSrtPath.replace(/^([A-Za-z]):/, '$1\\:');
      }

      // FFmpeg requires the path to be quoted for subtitles filter
      // Use force_style to avoid original_size issues
      let subtitleFilter = `subtitles='${escapedSrtPath}':force_style='FontSize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,Shadow=1'`;

      console.log('Using subtitles filter with SRT file');
      console.log('SRT file path:', srtPath);
      console.log('Escaped SRT path:', escapedSrtPath);
      console.log('Subtitle filter:', subtitleFilter);

      // Use absolute paths - fluent-ffmpeg handles Windows paths correctly
      const finalVideoPath = path.resolve(videoPath);
      const finalOutputPath = path.resolve(outputPath);

      console.log('Video path:', finalVideoPath);
      console.log('Output path:', finalOutputPath);

      // Ensure output directory exists (reuse outputDir from above)
      const finalOutputDir = path.dirname(finalOutputPath);
      if (!fs.existsSync(finalOutputDir)) {
        fs.mkdirSync(finalOutputDir, { recursive: true });
        console.log('Created output directory:', finalOutputDir);
      }

      // Test if directory is writable
      try {
        const testFile = path.join(finalOutputDir, 'test-write.tmp');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log('Output directory is writable');
      } catch (writeErr) {
        console.error('Output directory is NOT writable:', writeErr);
        return reject(new Error('Cannot write to output directory: ' + writeErr.message));
      }

      // Remove existing output file if it exists
      if (fs.existsSync(finalOutputPath)) {
        try {
          fs.unlinkSync(finalOutputPath);
          console.log('Removed existing output file');
        } catch (err) {
          console.warn('Could not remove existing file:', err);
        }
      }

      ffmpeg(finalVideoPath)
        .videoFilters(subtitleFilter)
        .outputOptions('-c:v libx264') // Explicitly set video codec
        .outputOptions('-c:a copy') // Copy audio without re-encoding
        .format('mp4') // Explicitly set output format
        .output(finalOutputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg caption command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('Adding captions: ' + Math.round(progress.percent || 0) + '% done');
        })
        .on('end', () => {
          // Clean up SRT and ASS files
          try {
            if (fs.existsSync(srtPath)) {
              fs.unlinkSync(srtPath);
            }
            const assPath = srtPath.replace(/\.srt$/, '.ass');
            if (fs.existsSync(assPath)) {
              fs.unlinkSync(assPath);
            }
          } catch (err) {
            console.warn('Error cleaning up subtitle files:', err);
          }
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('FFmpeg caption error:', err);
          // Clean up SRT and ASS files
          try {
            if (fs.existsSync(srtPath)) {
              fs.unlinkSync(srtPath);
            }
            const assPath = srtPath.replace(/\.srt$/, '.ass');
            if (fs.existsSync(assPath)) {
              fs.unlinkSync(assPath);
            }
          } catch (cleanupErr) {
            console.warn('Error cleaning up subtitle files:', cleanupErr);
          }
          reject(err);
        })
        .run();
    });
  }

  parseSRT(srtContent) {
    // Parse SRT content into array of subtitle entries
    const entries = [];
    const blocks = srtContent.split(/\n\s*\n/);

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 3) continue;

      const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
      if (timeMatch) {
        const startTime = this.parseSRTTime(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
        const endTime = this.parseSRTTime(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);
        const text = lines.slice(2).join(' ').trim();

        if (text) {
          entries.push({ startTime, endTime, text });
        }
      }
    }

    return entries;
  }

  parseSRTTime(hours, minutes, seconds, milliseconds) {
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(milliseconds) / 1000;
  }

  convertSRTtoASS(srtContent) {
    // Simple SRT to ASS converter
    // ASS format is more compatible with FFmpeg on Windows
    const lines = srtContent.split('\n');
    let assContent = '[Script Info]\n';
    assContent += 'Title: Generated Subtitles\n';
    assContent += 'ScriptType: v4.00+\n\n';
    assContent += '[V4+ Styles]\n';
    assContent += 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n';
    assContent += 'Style: Default,Arial,24,&Hffffff,&Hffffff,&H000000,&H000000,0,0,0,0,100,100,0,0,1,2,0,10,10,10,10,1\n\n';
    assContent += '[Events]\n';
    assContent += 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';

    let i = 0;
    while (i < lines.length) {
      // Skip sequence number
      if (/^\d+$/.test(lines[i].trim())) {
        i++;
        // Parse timestamp
        const timeMatch = lines[i]?.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
        if (timeMatch) {
          const start = `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}.${timeMatch[4].substring(0, 2)}`;
          const end = `${timeMatch[5]}:${timeMatch[6]}:${timeMatch[7]}.${timeMatch[8].substring(0, 2)}`;
          i++;
          // Get text (may span multiple lines)
          let text = '';
          while (i < lines.length && lines[i].trim() !== '') {
            text += (text ? '\\N' : '') + lines[i].trim();
            i++;
          }
          if (text) {
            assContent += `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}\n`;
          }
        }
      }
      i++;
    }
    return assContent;
  }

  generateSRT(transcript, style) {
    if (!transcript) {
      console.warn('No transcript provided for SRT generation');
      return '';
    }

    // Handle different transcript formats
    let words = [];
    if (transcript.words && Array.isArray(transcript.words) && transcript.words.length > 0) {
      words = transcript.words;
    } else if (transcript.text) {
      // Fallback: create simple word array from text
      const textWords = transcript.text.split(' ');
      words = textWords.map((word, index) => ({
        word: word,
        startTime: index * 1.0, // 1 second per word (rough estimate)
        endTime: (index + 1) * 1.0,
      }));
    } else {
      console.warn('Transcript has no words or text');
      return '';
    }

    if (words.length === 0) {
      return '';
    }

    let srtContent = '';
    let index = 1;
    let currentStart = words[0].startTime || 0;
    let currentEnd = words[0].endTime || 1;
    let currentText = words[0].word || '';

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const prevWord = words[i - 1];
      const timeDiff = (word.startTime || 0) - (prevWord.endTime || 0);

      // Group words into phrases (every 4-6 words or when there's a pause > 0.5s)
      if (i % 5 === 0 || timeDiff > 0.5) {
        srtContent += `${index}\n`;
        srtContent += `${this.formatSRTTime(currentStart)} --> ${this.formatSRTTime(currentEnd)}\n`;
        srtContent += `${currentText.trim()}\n\n`;

        index++;
        currentStart = word.startTime || currentEnd;
        currentText = word.word || '';
      } else {
        currentText += ' ' + (word.word || '');
      }
      currentEnd = word.endTime || (currentStart + 1);
    }

    // Add last subtitle
    if (currentText.trim()) {
      srtContent += `${index}\n`;
      srtContent += `${this.formatSRTTime(currentStart)} --> ${this.formatSRTTime(currentEnd)}\n`;
      srtContent += `${currentText.trim()}\n\n`;
    }

    return srtContent;
  }

  formatSRTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 60 - secs) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis.toString().padStart(3, '0')}`;
  }

  async addWatermark(videoPath, outputPath, watermarkText = 'WanderCut') {
    return new Promise((resolve, reject) => {
      // Use drawtext filter without requiring external font file
      // FFmpeg will use default font
      const filterString = `drawtext=text='${watermarkText}':fontsize=48:fontcolor=white@0.8:x=(w-text_w)/2:y=h-th-60:box=1:boxcolor=black@0.5:boxborderw=5`;

      ffmpeg(videoPath)
        .videoFilters(filterString)
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(err))
        .run();
    });
  }

  timeToSeconds(timeString) {
    // Handle numeric input
    if (typeof timeString === 'number') {
      return timeString;
    }

    // Handle string input
    if (typeof timeString !== 'string') {
      return parseFloat(timeString) || 0;
    }

    // Remove 's' suffix if present (e.g., "2.2s" -> "2.2")
    let cleaned = timeString.trim();
    if (cleaned.endsWith('s') || cleaned.endsWith('S')) {
      cleaned = cleaned.slice(0, -1);
    }

    // Handle MM:SS.S format (e.g., "0:02.2" or "2:30.5")
    if (cleaned.includes(':')) {
      const parts = cleaned.split(':');

      if (parts.length === 2) {
        // MM:SS.S format
        const minutes = parseInt(parts[0], 10) || 0;
        const seconds = parseFloat(parts[1]) || 0;
        return minutes * 60 + seconds;
      } else if (parts.length === 3) {
        // HH:MM:SS.S format
        const hours = parseInt(parts[0], 10) || 0;
        const minutes = parseInt(parts[1], 10) || 0;
        const seconds = parseFloat(parts[2]) || 0;
        return hours * 3600 + minutes * 60 + seconds;
      }
    }

    // Fallback: try to parse as a simple decimal number
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed)) {
      return parsed;
    }

    // If all else fails, return 0
    console.warn(`Could not parse time string: ${timeString}, defaulting to 0`);
    return 0;
  }
}

module.exports = new VideoProcessor();
