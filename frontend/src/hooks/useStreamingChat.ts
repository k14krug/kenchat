import { useState, useCallback, useRef } from 'react';
import { chatAPI } from '../services/api';
import { Message } from '../store/slices/conversationSlice';

interface StreamingChatOptions {
  onUserMessage?: (message: Message) => void;
  onContentChunk?: (chunk: string, accumulated: string) => void;
  onAssistantMessage?: (message: Message, aiResponse: any) => void;
  onError?: (error: { message: string; code: string }) => void;
  onComplete?: () => void;
  onStatusUpdate?: (status: string) => void;
}

interface StreamingChatState {
  isStreaming: boolean;
  currentContent: string;
  error: string | null;
  status: string | null;
}

export const useStreamingChat = (options: StreamingChatOptions = {}) => {
  const [state, setState] = useState<StreamingChatState>({
    isStreaming: false,
    currentContent: '',
    error: null,
    status: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendStreamingMessage = useCallback(async (data: {
    conversationId: string;
    content: string;
    personaId?: string;
    model?: string;
    options?: any;
  }) => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setState({
      isStreaming: true,
      currentContent: '',
      error: null,
      status: 'Starting...',
    });

    try {
      // Create abort controller for cleanup
      abortControllerRef.current = new AbortController();

      // Make the streaming request
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/chat/generate/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6));
              
              switch (eventData.type) {
                case 'status':
                  setState(prev => ({ ...prev, status: eventData.message }));
                  options.onStatusUpdate?.(eventData.message);
                  break;

                case 'user_message':
                  options.onUserMessage?.(eventData.data);
                  break;

                case 'content_chunk':
                  accumulatedContent = eventData.data.accumulated;
                  setState(prev => ({ 
                    ...prev, 
                    currentContent: accumulatedContent,
                    status: 'Generating...'
                  }));
                  options.onContentChunk?.(eventData.data.chunk, accumulatedContent);
                  break;

                case 'assistant_message':
                  options.onAssistantMessage?.(eventData.data.message, eventData.data.aiResponse);
                  break;

                case 'complete':
                  setState(prev => ({ 
                    ...prev, 
                    isStreaming: false,
                    status: 'Complete'
                  }));
                  options.onComplete?.();
                  break;

                case 'error':
                  setState(prev => ({ 
                    ...prev, 
                    isStreaming: false,
                    error: eventData.error.message,
                    status: 'Error'
                  }));
                  options.onError?.(eventData.error);
                  break;
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Request was aborted, don't treat as error
        setState(prev => ({ 
          ...prev, 
          isStreaming: false,
          status: 'Cancelled'
        }));
      } else {
        setState(prev => ({ 
          ...prev, 
          isStreaming: false,
          error: error.message,
          status: 'Error'
        }));
        options.onError?.({ message: error.message, code: 'NETWORK_ERROR' });
      }
    }
  }, [options]);

  const sendRegularMessage = useCallback(async (data: {
    conversationId: string;
    content: string;
    personaId?: string;
    model?: string;
    options?: any;
  }) => {
    setState({
      isStreaming: true,
      currentContent: '',
      error: null,
      status: 'Generating...',
    });

    try {
      const response = await chatAPI.generateResponse(data);
      
      // Simulate the streaming callbacks for consistency
      options.onUserMessage?.(response.userMessage);
      options.onAssistantMessage?.(response.assistantMessage, response.aiResponse);
      options.onComplete?.();

      setState({
        isStreaming: false,
        currentContent: response.assistantMessage.content,
        error: null,
        status: 'Complete',
      });
    } catch (error: any) {
      setState({
        isStreaming: false,
        currentContent: '',
        error: error.message,
        status: 'Error',
      });
      options.onError?.({ message: error.message, code: 'API_ERROR' });
    }
  }, [options]);

  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setState(prev => ({ 
      ...prev, 
      isStreaming: false,
      status: 'Cancelled'
    }));
  }, []);

  const retry = useCallback((data: {
    conversationId: string;
    content: string;
    personaId?: string;
    model?: string;
    options?: any;
  }, useStreaming: boolean = true) => {
    if (useStreaming) {
      sendStreamingMessage(data);
    } else {
      sendRegularMessage(data);
    }
  }, [sendStreamingMessage, sendRegularMessage]);

  return {
    ...state,
    sendStreamingMessage,
    sendRegularMessage,
    cancelStreaming,
    retry,
  };
};