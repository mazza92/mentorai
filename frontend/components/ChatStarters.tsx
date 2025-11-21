import React from 'react';

interface ChatStartersProps {
  questions: string[];
  onQuestionClick: (question: string) => void;
  sourceCount?: number;
}

/**
 * NotebookLM-style chat starter questions
 * Shows suggested questions that users can click to ask
 */
export default function ChatStarters({ questions, onQuestionClick, sourceCount }: ChatStartersProps) {
  if (!questions || questions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Source count badge (NotebookLM style) */}
      {sourceCount && (
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-medium">
          {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
        </div>
      )}

      {/* Suggested questions */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Suggested questions
        </h3>
        <div className="grid gap-2">
          {questions.map((question, index) => (
            <button
              key={index}
              onClick={() => onQuestionClick(question)}
              className="group text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-200"
            >
              <div className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-purple-700 dark:group-hover:text-purple-300">
                  {question}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
