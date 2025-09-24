import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface ContactTagsDisplayProps {
  contactId?: string;
}

export function ContactTagsDisplay({ contactId }: ContactTagsDisplayProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchContactTags = async () => {
      if (!contactId) return;
      
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('contact_tags')
          .select(`
            tags (
              id,
              name,
              color
            )
          `)
          .eq('contact_id', contactId);

        if (error) throw error;
        
        const contactTags = data?.map(item => item.tags).filter(Boolean) || [];
        setTags(contactTags as Tag[]);
      } catch (err) {
        console.error('Error fetching contact tags:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContactTags();
  }, [contactId]);

  if (isLoading) {
    return (
      <div className="flex gap-1">
        <div className="w-12 h-5 bg-gray-200 rounded animate-pulse"></div>
        <div className="w-16 h-5 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <span className="text-xs text-muted-foreground italic">
        Sem tags do contato
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, 3).map((tag) => (
        <Badge 
          key={tag.id} 
          variant="outline" 
          className="text-xs px-2 py-0.5 h-auto"
          style={{ 
            backgroundColor: tag.color || '#808080', 
            borderColor: tag.color || '#808080',
            color: 'white'
          }}
        >
          {tag.name}
        </Badge>
      ))}
      {tags.length > 3 && (
        <Badge variant="outline" className="text-xs px-2 py-0.5 h-auto">
          +{tags.length - 3}
        </Badge>
      )}
    </div>
  );
}