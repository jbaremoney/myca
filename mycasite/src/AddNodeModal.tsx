import { useState } from "react";
import "./AddNodeModal.css";

interface AddNodeModalProps {
  onClose: () => void;
  onSubmit: (formData: AgentUpsertPayload) => void | Promise<void>;
}

interface RawFormData {
  agent_id: string;
  name: string;
  description: string;
  mcp_url: string;
  modalities: string;
  tags: string;
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

export default function AddNodeModal({
  onClose,
  onSubmit,
}: AddNodeModalProps) {
  const [formData, setFormData] = useState<RawFormData>({
  agent_id: "",
  name: "",
  description: "",
  mcp_url: "",
  modalities: "",
  tags: "",
});

  const [error, setError] = useState<string>("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();

    if (!formData.agent_id.trim()) {
        setError("Agent ID is required.");
        return;
    }

    if (!formData.name.trim()) {
        setError("Agent name is required.");
        return;
    }

    if (!formData.mcp_url.trim()) {
        setError("MCP URL is required.");
        return;
    }

    const formattedData: AgentUpsertPayload = {
        agent_id: formData.agent_id.trim(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        mcp_url: formData.mcp_url.trim(),
        modalities: formData.modalities
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
        tags: formData.tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
        tools: {},
    };

    setError("");
    onSubmit(formattedData);
    };

  return (
    <div className="add-node-modal-overlay" onClick={onClose}>
      <div
        className="add-node-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="add-node-modal-header">
          <h2>Add New Node</h2>
          <button
            className="close-modal-button"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <form className="add-node-form" onSubmit={handleSubmit}>
          <label>
            Agent ID
            <input
                type="text"
                name="agent_id"
                value={formData.agent_id}
                onChange={handleChange}
                placeholder="path-agent"
            />
          </label>
          <label>
            Agent Name
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Pathology Classifier"
            />
          </label>

          <label>
            Description
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Classifies pathology-related medical images..."
              rows={4}
            />
          </label>

          <label>
            MCP URL
            <input
              type="text"
              name="mcp_url"
              value={formData.mcp_url}
              onChange={handleChange}
              placeholder="https://your-agent-url.com/mcp"
            />
          </label>

          <label>
            Modalities
            <input
              type="text"
              name="modalities"
              value={formData.modalities}
              onChange={handleChange}
              placeholder="image, xray, ct"
            />
          </label>

          <label>
            Tags
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="medical, classifier, pathology"
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="add-node-form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="primary-button">
              Add Node
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}