
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Function to generate chat responses with streaming
export async function generateChatResponse(messages: ChatMessage[]): Promise<string> {
  try {
    const latestMessage = messages[messages.length - 1];
    const response = await fetch('http://localhost:8000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: latestMessage.content }),
    });

    if (!response.ok) {
      throw new Error('Failed to get response from API');
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error in generateChatResponse:', error);
    throw error;
  }
}
