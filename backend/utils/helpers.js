/**
 * Utility helper functions
 */

/**
 * Format time string (MM:SS or HH:MM:SS) to seconds
 */
function timeToSeconds(timeString) {
  if (!timeString) return 0;
  
  const parts = timeString.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  } else if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  }
  return parseFloat(timeString) || 0;
}

/**
 * Format seconds to time string (HH:MM:SS)
 */
function secondsToTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Validate video file
 */
function isValidVideoFile(file) {
  const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
  const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv'];
  
  const hasValidType = allowedTypes.includes(file.mimetype);
  const hasValidExtension = allowedExtensions.some(ext => 
    file.originalname.toLowerCase().endsWith(ext)
  );
  
  return hasValidType || hasValidExtension;
}

/**
 * Get file size in human readable format
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

module.exports = {
  timeToSeconds,
  secondsToTime,
  isValidVideoFile,
  formatFileSize,
};

