import { EditarAgente } from '@/components/modules/EditarAgente';
import { useParams } from 'react-router-dom';

export default function EditarAgentePage() {
  const { agentId } = useParams<{ agentId: string }>();
  
  if (!agentId) {
    return <div>Agent ID not found</div>;
  }
  
  return <EditarAgente agentId={agentId} />;
}