import { useEffect, useState } from 'react';
import './RegistryPage.css'

interface RegistryPageProps {
  onBack: () => void;
}

interface Agent {
  agent_id: string;
  name: string;
  mcp_url: string;
  description?: string;
  tags?: string[];
  modalities?: string[];
  tools?: Record<string, unknown>;
  is_active?: boolean;
  created_at?: string;
}

const API_BASE = 'https://aofbnauuix32ebcof5guv5nxai0mblkm.lambda-url.us-east-1.on.aws';
const API_KEY = 'dev-key';

export default function RegistryPage({ onBack }: RegistryPageProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentIdInput, setAgentIdInput] = useState<string>('');
  const [loadingAll, setLoadingAll] = useState<boolean>(false);
  const [loadingOne, setLoadingOne] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  };

  const fetchAllAgents = async (): Promise<void> => {
    setLoadingAll(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_BASE}/agents`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch agents (${response.status}): ${text}`);
      }

      const data = await response.json();
      console.log('GET /agents returned:', data);

      if (!data.ok) {
        throw new Error('Router returned ok=false for GET /agents.');
      }

      setAgents(Array.isArray(data.agents) ? data.agents : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load agents.';
      setError(message);
      setAgents([]);
    } finally {
      setLoadingAll(false);
    }
  };

  const fetchAgentById = async (agentId: string): Promise<void> => {
    if (!agentId.trim()) {
      setError('Please enter an agent ID.');
      return;
    }

    setLoadingOne(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_BASE}/agents/${encodeURIComponent(agentId)}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch agent (${response.status}): ${text}`);
      }

      const data: Agent = await response.json();
      setSelectedAgent(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load agent.';
      setSelectedAgent(null);
      setError(message);
    } finally {
      setLoadingOne(false);
    }
  };

  const handleDeleteAgent = async (agentId: string): Promise<void> => {
    const confirmed = window.confirm(`Delete agent "${agentId}"?`);
    if (!confirmed) return;

    setDeletingId(agentId);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_BASE}/agents/${encodeURIComponent(agentId)}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to delete agent (${response.status}): ${text}`);
      }

      setAgents((prev) => prev.filter((agent) => agent.agent_id !== agentId));

      if (selectedAgent?.agent_id === agentId) {
        setSelectedAgent(null);
      }

      setSuccess(`Deleted agent: ${agentId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete agent.';
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    void fetchAllAgents();
  }, []);

  return (
    <div className="registry-page">
      <div className="registry-header">
        <button className="registry-back-button" onClick={onBack}>
          ← Back
        </button>
        <div>
          <h1>Agent Registry</h1>
          <p>View all agents, inspect a specific one, and delete agents from the registry.</p>
        </div>
      </div>

      {error && <div className="registry-message error">{error}</div>}
      {success && <div className="registry-message success">{success}</div>}

      <div className="registry-controls">
        <button
          className="registry-button"
          onClick={() => void fetchAllAgents()}
          disabled={loadingAll}
        >
          {loadingAll ? 'Refreshing...' : 'Refresh All Agents'}
        </button>

        <div className="registry-search-box">
          <input
            type="text"
            value={agentIdInput}
            onChange={(e) => setAgentIdInput(e.target.value)}
            placeholder="Enter agent_id"
            className="registry-input"
          />
          <button
            className="registry-button"
            onClick={() => void fetchAgentById(agentIdInput)}
            disabled={loadingOne}
          >
            {loadingOne ? 'Loading...' : 'Load Agent'}
          </button>
        </div>
      </div>

      <div className="registry-layout">
        <div className="registry-panel">
          <h2>All Agents</h2>

          {loadingAll ? (
            <p>Loading agents...</p>
          ) : agents.length === 0 ? (
            <p>No agents found.</p>
          ) : (
            <div className="registry-agent-list">
              {agents.map((agent) => (
                <div key={agent.agent_id} className="registry-agent-card">
                  <div className="registry-agent-main">
                    <h3>{agent.name || 'Unnamed Agent'}</h3>
                    <p><strong>ID:</strong> {agent.agent_id}</p>
                    <p><strong>MCP URL:</strong> {agent.mcp_url}</p>
                    <p><strong>Description:</strong> {agent.description || 'None'}</p>
                    <p>
                      <strong>Tags:</strong>{' '}
                      {agent.tags && agent.tags.length > 0 ? agent.tags.join(', ') : 'None'}
                    </p>
                    <p>
                      <strong>Modalities:</strong>{' '}
                      {agent.modalities && agent.modalities.length > 0
                        ? agent.modalities.join(', ')
                        : 'None'}
                    </p>
                  </div>

                  <div className="registry-agent-actions">
                    <button
                      className="registry-button secondary"
                      onClick={() => void fetchAgentById(agent.agent_id)}
                    >
                      View
                    </button>

                    <button
                      className="registry-button danger"
                      onClick={() => void handleDeleteAgent(agent.agent_id)}
                      disabled={deletingId === agent.agent_id}
                    >
                      {deletingId === agent.agent_id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* <div className="registry-panel">
          <h2>Selected Agent</h2>

          {!selectedAgent ? (
            <p>Select an agent to view its full details.</p>
          ) : (
            <div className="registry-selected-card">
              <p><strong>Name:</strong> {selectedAgent.name || 'Unnamed Agent'}</p>
              <p><strong>Agent ID:</strong> {selectedAgent.agent_id}</p>
              <p><strong>MCP URL:</strong> {selectedAgent.mcp_url}</p>
              <p><strong>Description:</strong> {selectedAgent.description || 'None'}</p>

              <p>
                <strong>Tags:</strong>{' '}
                {selectedAgent.tags && selectedAgent.tags.length > 0
                  ? selectedAgent.tags.join(', ')
                  : 'None'}
              </p>

              <p>
                <strong>Modalities:</strong>{' '}
                {selectedAgent.modalities && selectedAgent.modalities.length > 0
                  ? selectedAgent.modalities.join(', ')
                  : 'None'}
              </p>

              <p>
                <strong>Active:</strong>{' '}
                {typeof selectedAgent.is_active === 'boolean'
                  ? selectedAgent.is_active
                    ? 'Yes'
                    : 'No'
                  : 'Unknown'}
              </p>

              {selectedAgent.created_at && (
                <p><strong>Created At:</strong> {selectedAgent.created_at}</p>
              )}

              <div className="registry-tools-block">
                <strong>Tools:</strong>
                <pre>{JSON.stringify(selectedAgent.tools ?? {}, null, 2)}</pre>
              </div>

              <button
                className="registry-button danger"
                onClick={() => void handleDeleteAgent(selectedAgent.agent_id)}
                disabled={deletingId === selectedAgent.agent_id}
              >
                {deletingId === selectedAgent.agent_id ? 'Deleting...' : 'Delete This Agent'}
              </button>
            </div>
          )}
        </div> */}
      </div>
    </div>
  );
}