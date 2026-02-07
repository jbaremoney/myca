import { useState, useEffect, useRef } from 'react'
import { HomeAgent } from './agent/HomeAgent'
import type { Message } from './agent/HomeAgent'
import './App.css'

function App() {
  const [apiKey, setApiKey] = useState<string>('')
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const homeAgentRef = useRef<HomeAgent | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Create a single instance of HomeAgent
    if (!homeAgentRef.current) {
      homeAgentRef.current = new HomeAgent()
    }
  }, [])

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Messages will be loaded after first interaction with agent

  const handleApiKeySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!apiKey.trim()) {
      setError('Please enter an API key')
      return
    }

    try {
      // Initialize HomeAgent with the API key
      homeAgentRef.current?.initialize(apiKey.trim())
      setIsInitialized(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize agent')
    }
  }

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!input.trim() || isLoading || !homeAgentRef.current) {
      return
    }

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)
    setError('')

    try {
      // Run the agent (it will handle state internally)
      await homeAgentRef.current.run(userMessage)

      // Get updated messages from agent state (synchronous now)
      const updatedMessages = homeAgentRef.current.getMessages()
      setMessages(updatedMessages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  // Show API key prompt if not initialized
  if (!isInitialized) {
    return (
      <div className="api-key-prompt">
        <div className="api-key-modal">
          <h1>Welcome to HomeAgent</h1>
          <p>Please enter your OpenAI API key to get started</p>
          <form onSubmit={handleApiKeySubmit}>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="api-key-input"
              autoFocus
            />
            {error && <p className="error-message">{error}</p>}
            <button type="submit" className="submit-button">
              Initialize Agent
            </button>
          </form>
          <p className="api-key-note">
            Your API key is stored in session memory and will not be saved to disk.
          </p>
        </div>
      </div>
    )
  }

  // Chat interface after initialization
  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <h1>HomeAgent</h1>
            <p>How can I help you today?</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`chat-message ${msg.role}`}>
              <div className="message-content">
                {msg.content}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="chat-message assistant">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-container">
        <form onSubmit={handleChatSubmit} className="chat-input-form">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message HomeAgent..."
            className="chat-input"
            disabled={isLoading}
            autoFocus
          />
          <button 
            type="submit" 
            className="chat-send-button"
            disabled={isLoading || !input.trim()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </form>
        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  )
}

export default App
