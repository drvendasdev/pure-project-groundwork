import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Edit, Trash2, Loader2 } from "lucide-react";
import { useTags } from "@/hooks/useTags";
import { EditTagModal } from "@/components/modals/EditTagModal";
import { DeleteTagModal } from "@/components/modals/DeleteTagModal";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";

export function CRMTags() {
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editingTag, setEditingTag] = useState<{ id: string; name: string; color: string } | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [deletingTag, setDeletingTag] = useState<{ id: string; name: string } | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const { selectedWorkspace } = useWorkspace();
  const { tags, isLoading, createTag, updateTag, deleteTag } = useTags(selectedWorkspace?.workspace_id);
  const { toast } = useToast();

  // Fetch contact counts for each tag
  const fetchTagCounts = async () => {
    if (!selectedWorkspace?.workspace_id || !tags.length) return;
    
    const counts: Record<string, number> = {};
    
    for (const tag of tags) {
      const { count } = await supabase
        .from('contact_tags')
        .select('*', { count: 'exact' })
        .eq('tag_id', tag.id);
      
      counts[tag.id] = count || 0;
    }
    
    setTagCounts(counts);
  };

  useEffect(() => {
    fetchTagCounts();
  }, [tags, selectedWorkspace?.workspace_id]);

  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditTag = (tag: any) => {
    setIsCreateMode(false);
    setEditingTag({
      id: tag.id,
      name: tag.name,
      color: tag.color
    });
    setIsEditModalOpen(true);
  };

  const handleCreateTag = () => {
    setIsCreateMode(true);
    setEditingTag(null);
    setIsEditModalOpen(true);
  };

  const handleDeleteTag = (tag: any) => {
    setDeletingTag({ id: tag.id, name: tag.name });
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteTag = async () => {
    if (deletingTag) {
      await deleteTag(deletingTag.id);
      setDeletingTag(null);
    }
  };

  const handleTagSaved = async (tagData: { id?: string; name: string; color: string }) => {
    let success = false;
    
    if (isCreateMode) {
      const result = await createTag(tagData.name, tagData.color);
      success = result.success;
    } else if (tagData.id) {
      const result = await updateTag(tagData.id, tagData.name, tagData.color);
      success = result.success;
    }
    
    // Reset state only if successful - modal closes itself now
    if (success) {
      setEditingTag(null);
      setIsCreateMode(false);
    }
  };

  const getColorStyle = (color: string) => {
    if (color.startsWith('#')) {
      return {
        backgroundColor: color + '20', // Add transparency
        color: color,
        border: `1px solid ${color}40`
      };
    }
    return {}; // Fallback for old format
  };

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6">Tags</h1>
          
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Buscar usuário"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            
            <div className="relative">
              <Input
                type="date"
                placeholder="Data inicial"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pr-10"
              />
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            
            <div className="relative">
              <Input
                type="date"
                placeholder="Data final"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pr-10"
              />
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            
            <Button variant="warning" className="whitespace-nowrap" onClick={handleCreateTag}>
              + Criar
            </Button>
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table style={{ fontSize: '12px' }}>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-center">Contatos Tageados</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p>Carregando tags...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredTags.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      <p className="text-gray-500">Nenhuma tag encontrada</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTags.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          style={getColorStyle(tag.color)}
                          className="font-medium"
                        >
                          {tag.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{tagCounts[tag.id] || 0}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => handleEditTag(tag)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteTag(tag)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      
        <EditTagModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setIsCreateMode(false);
            setEditingTag(null);
          }}
          tag={editingTag}
          onTagUpdated={handleTagSaved}
          isCreateMode={isCreateMode}
        />
        
        <DeleteTagModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setDeletingTag(null);
          }}
          onConfirm={confirmDeleteTag}
          tagName={deletingTag?.name}
        />
    </div>
  );
}