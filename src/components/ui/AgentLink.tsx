import type React from 'react';
import { Link } from 'react-router-dom';

export function AgentLink({ agentId, children }: { agentId: string; children: React.ReactNode }) {
  return (
    <Link to={`/agents/${agentId}`} className="agent-link">
      {children}
    </Link>
  );
}
