import { useState, useEffect, useRef } from 'react'
import { HomeAgent } from './agent/HomeAgent'
import type { Message } from './agent/HomeAgent'
import './App.css'
import AddNodeModal from './AddNodeModal'
import RegistryPage from './RegistryPage'

interface UploadedImage {
  base64: string
  filename: string
}

export interface AgentUpsertPayload {
  agent_id: string;
  name: string;
  mcp_url: string;
  description: string;
  tags: string[];
  modalities: string[];
  tools: Record<string, unknown>;
}

function App() {
  const [apiKey, setApiKey] = useState<string>('')
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null)
  const [open, setOpen] = useState(false);
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [view, setView] = useState<'chat' | 'registry'>('chat');
  const homeAgentRef = useRef<HomeAgent | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    setIsLoading(true)
    setError('')

    try {
      // Run the agent with message and optional image
      await homeAgentRef.current.run(userMessage, uploadedImage?.base64)

      // Get updated messages from agent state (synchronous now)
      const updatedMessages = homeAgentRef.current.getMessages()
      setMessages(updatedMessages)

      // Clear uploaded image after submit
      setUploadedImage(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsLoading(false)
      setInput('')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate PNG file
    if (file.type !== 'image/png') {
      setError('Please select a PNG file')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64String = event.target?.result as string
      setUploadedImage({
        base64: base64String,
        filename: file.name,
      })
      setError('')
    }
    reader.onerror = () => {
      setError('Failed to read file')
    }
    reader.readAsDataURL(file)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveImage = () => {
    setUploadedImage(null)
  }

  const handleCloseModal = () => {
    setShowAddNodeModal(false);
  };

  const handleSubmitNode = async (formData: AgentUpsertPayload): Promise<void> => {
    try {
      const response = await fetch("https://aofbnauuix32ebcof5guv5nxai0mblkm.lambda-url.us-east-1.on.aws/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "dev-key",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add agent: ${errorText}`);
      }

      const result = await response.json();
      console.log("Agent added:", result);

      setShowAddNodeModal(false);
    } catch (error) {
      console.error("Error adding agent:", error);
    }
  };

  // Chat interface after initialization
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

  if (view === 'registry') {
    return (
      <RegistryPage
        onBack={() => setView('chat')}
      />
    )
  }

  // Chat interface after initialization
  return (
    <div className="chat-container">
      <div className="node-menu-container">
        <button
          className={`node-menu-tab ${open ? "open" : ""}`}
          onClick={() => setOpen(!open)}
          aria-label="Toggle node menu"
        >
          <svg
            className="node-menu-chevron"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M6 9L12 15L18 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {open && (
          <div className="node-dropdown-menu">
            <button
              className="node-dropdown-item"
              onClick={() => {
                setShowAddNodeModal(true);
                setOpen(false);
              }}
            >
              Add Node
            </button>
            <button
              className="node-dropdown-item"
              onClick={() => {
                setView('registry');
                setOpen(false);
              }}
            >
              Registry
            </button>
          </div>
        )}
      </div>

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

                {msg.agentInfo && (
                  <details className="agent-info-dropdown">
                    <summary>View routed agent info</summary>
                    <div className="agent-info-card">
                      {msg.agentInfo.agentName && (
                        <p><strong>Agent:</strong> {msg.agentInfo.agentName}</p>
                      )}

                      {msg.agentInfo.dataset && (
                        <p><strong>Dataset:</strong> {msg.agentInfo.dataset}</p>
                      )}

                      {/* {msg.agentInfo.predictedLabel && (
                        <p><strong>Prediction:</strong> {msg.agentInfo.predictedLabel}</p>
                      )}

                      {typeof msg.agentInfo.classIndex === "number" && (
                        <p><strong>Class Index:</strong> {msg.agentInfo.classIndex}</p>
                      )}

                      {msg.agentInfo.probabilities && (
                        <div>
                          <strong>Probabilities:</strong>
                          <ul>
                            {Object.entries(msg.agentInfo.probabilities).map(([label, prob]) => (
                              <li key={label}>
                                {label}: {(prob * 100).toFixed(2)}%
                              </li>
                            ))}
                          </ul>
                        </div>
                      )} */}

                      {msg.agentInfo.disclaimer && (
                        <p><strong>Disclaimer:</strong> {msg.agentInfo.disclaimer}</p>
                      )}
                    </div>
                  </details>
                )}
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
        {uploadedImage && (
          <div className="image-preview-container">
            <div className="image-preview">
              <img src={uploadedImage.base64} alt="Uploaded" />
              <button
                type="button"
                className="remove-image-button"
                onClick={handleRemoveImage}
                title="Remove image"
              >
                ✕
              </button>
            </div>
            <span className="image-filename">{uploadedImage.filename}</span>
          </div>
        )}

        <form onSubmit={handleChatSubmit} className="chat-input-form">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/png"
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="file-upload-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="Upload PNG file"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L12 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M2 12L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

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

        {showAddNodeModal && (
          <AddNodeModal
            onClose={handleCloseModal}
            onSubmit={handleSubmitNode}
          />
        )}

        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  )
}

export default App
