// Shared mock storage for development mode
// This allows all routes to access the same in-memory data

const mockProjects = new Map();
const mockUsers = new Map();
const mockConversations = new Map();

function initMockStorage() {
  // Initialize if needed
  if (!mockConversations) {
    // Already initialized
  }
}

module.exports = {
  mockProjects,
  mockUsers,
  mockConversations,
  initMockStorage,
};

