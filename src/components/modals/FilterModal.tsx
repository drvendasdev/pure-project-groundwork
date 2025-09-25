import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, ClockIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTags } from "@/hooks/useTags";

interface FilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

export function FilterModal({ open, onOpenChange }: FilterModalProps) {
  const { tags: availableTags, isLoading: tagsLoading } = useTags();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [startTime, setStartTime] = useState({ hour: 0, minute: 0 });
  const [endTime, setEndTime] = useState({ hour: 23, minute: 59 });
  const [onlyUnreadMessages, setOnlyUnreadMessages] = useState(false);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [showStartTimeSelector, setShowStartTimeSelector] = useState(false);
  const [showEndTimeSelector, setShowEndTimeSelector] = useState(false);

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const TimeSelector = ({ 
    value, 
    onChange, 
    type,
    onClose 
  }: { 
    value: { hour: number; minute: number }; 
    onChange: (time: { hour: number; minute: number }) => void;
    type: 'hour' | 'minute';
    onClose: () => void;
  }) => {
    const [currentType, setCurrentType] = useState<'hour' | 'minute'>('hour');
    const [tempTime, setTempTime] = useState(value);

    const generateHourCircle = () => {
      const hours = Array.from({ length: 24 }, (_, i) => i);
      const centerX = 120;
      const centerY = 120;
      const radius = 80;

      return hours.map((hour) => {
        const angle = (hour * 15 - 90) * (Math.PI / 180);
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        
        return (
          <button
            key={hour}
            className={cn(
              "absolute w-8 h-8 rounded-full text-sm font-medium transition-colors",
              tempTime.hour === hour
                ? "bg-orange-500 text-white"
                : "hover:bg-gray-100 text-gray-700"
            )}
            style={{
              left: x - 16,
              top: y - 16,
            }}
            onClick={() => setTempTime(prev => ({ ...prev, hour }))}
          >
            {hour.toString().padStart(2, '0')}
          </button>
        );
      });
    };

    const generateMinuteCircle = () => {
      const minutes = Array.from({ length: 60 }, (_, i) => i);
      const centerX = 120;
      const centerY = 120;
      const radius = 80;

      return minutes.filter(m => m % 5 === 0).map((minute) => {
        const angle = (minute * 6 - 90) * (Math.PI / 180);
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        
        return (
          <button
            key={minute}
            className={cn(
              "absolute w-8 h-8 rounded-full text-sm font-medium transition-colors",
              tempTime.minute === minute
                ? "bg-orange-500 text-white"
                : "hover:bg-gray-100 text-gray-700"
            )}
            style={{
              left: x - 16,
              top: y - 16,
            }}
            onClick={() => setTempTime(prev => ({ ...prev, minute }))}
          >
            {minute.toString().padStart(2, '0')}
          </button>
        );
      });
    };

    const handleConfirm = () => {
      onChange(tempTime);
      onClose();
    };

    return (
      <div className="p-6 w-80">
        <div className="flex justify-center mb-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              className={cn(
                "px-4 py-1 text-sm rounded-md transition-colors",
                currentType === 'hour' ? "bg-white shadow-sm" : "hover:bg-gray-200"
              )}
              onClick={() => setCurrentType('hour')}
            >
              {tempTime.hour.toString().padStart(2, '0')}
            </button>
            <span className="px-1 self-center">:</span>
            <button
              className={cn(
                "px-4 py-1 text-sm rounded-md transition-colors",
                currentType === 'minute' ? "bg-white shadow-sm" : "hover:bg-gray-200"
              )}
              onClick={() => setCurrentType('minute')}
            >
              {tempTime.minute.toString().padStart(2, '0')}
            </button>
          </div>
        </div>

        <div className="relative w-60 h-60 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full bg-gray-50 border-2 border-gray-200"></div>
          
          {/* Center point */}
          <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-orange-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 z-10"></div>
          
          {/* Hand */}
          {currentType === 'hour' && (
            <div
              className="absolute top-1/2 left-1/2 w-0.5 bg-orange-500 origin-bottom z-10"
              style={{
                height: '60px',
                transform: `translate(-50%, -100%) rotate(${tempTime.hour * 15 - 90}deg)`,
              }}
            />
          )}
          
          {currentType === 'minute' && (
            <div
              className="absolute top-1/2 left-1/2 w-0.5 bg-orange-500 origin-bottom z-10"
              style={{
                height: '60px',
                transform: `translate(-50%, -100%) rotate(${tempTime.minute * 6 - 90}deg)`,
              }}
            />
          )}
          
          {currentType === 'hour' ? generateHourCircle() : generateMinuteCircle()}
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="ghost" onClick={() => setTempTime({ hour: 0, minute: 0 })}>
            Clear
          </Button>
          <Button onClick={handleConfirm} className="bg-orange-500 hover:bg-orange-600">
            OK
          </Button>
        </div>
      </div>
    );
  };

  const handleClear = () => {
    setSelectedTags([]);
    setStartDate(undefined);
    setEndDate(undefined);
    setStartTime({ hour: 0, minute: 0 });
    setEndTime({ hour: 23, minute: 59 });
    setOnlyUnreadMessages(false);
  };

  const handleApply = () => {
    // Aplicar filtros aqui
    console.log({
      tags: selectedTags,
      startDate,
      endDate,
      startTime,
      endTime,
      onlyUnreadMessages
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Filtros</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Selecionar tags */}
          <div>
            <Label htmlFor="tags" className="text-sm font-medium">
              Selecionar tags
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal mt-1"
                  disabled={tagsLoading}
                >
                  {tagsLoading ? (
                    <span className="text-muted-foreground">Carregando tags...</span>
                  ) : selectedTags.length === 0 ? (
                    <span className="text-muted-foreground">Selecionar tags</span>
                  ) : (
                    <span>{selectedTags.length} tag(s) selecionada(s)</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="max-h-60 overflow-y-auto p-2">
                  {tagsLoading ? (
                    <div className="p-4 text-center text-muted-foreground">
                      Carregando tags...
                    </div>
                  ) : availableTags.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      Nenhuma tag encontrada
                    </div>
                  ) : (
                    availableTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        onClick={() => toggleTag(tag.id)}
                      >
                        <Checkbox
                          checked={selectedTags.includes(tag.id)}
                          onCheckedChange={() => toggleTag(tag.id)}
                        />
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="text-sm">{tag.name}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Data de início */}
          <div>
            <Label htmlFor="start-date" className="text-sm font-medium">
              Início
            </Label>
            <div className="flex space-x-2 mt-1">
              <Popover open={showStartCalendar} onOpenChange={setShowStartCalendar}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex-1 justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date);
                      setShowStartCalendar(false);
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              
              <Popover open={showStartTimeSelector} onOpenChange={setShowStartTimeSelector}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-24">
                    <ClockIcon className="mr-1 h-4 w-4" />
                    {`${startTime.hour.toString().padStart(2, '0')}:${startTime.minute.toString().padStart(2, '0')}`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <TimeSelector
                    value={startTime}
                    onChange={setStartTime}
                    type="hour"
                    onClose={() => setShowStartTimeSelector(false)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Data de fim */}
          <div>
            <Label htmlFor="end-date" className="text-sm font-medium">
              Fim
            </Label>
            <div className="flex space-x-2 mt-1">
              <Popover open={showEndCalendar} onOpenChange={setShowEndCalendar}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex-1 justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "Data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      setEndDate(date);
                      setShowEndCalendar(false);
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              
              <Popover open={showEndTimeSelector} onOpenChange={setShowEndTimeSelector}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-24">
                    <ClockIcon className="mr-1 h-4 w-4" />
                    {`${endTime.hour.toString().padStart(2, '0')}:${endTime.minute.toString().padStart(2, '0')}`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <TimeSelector
                    value={endTime}
                    onChange={setEndTime}
                    type="hour"
                    onClose={() => setShowEndTimeSelector(false)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Checkbox para mensagens não lidas */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="unread-messages"
              checked={onlyUnreadMessages}
              onCheckedChange={(checked) => setOnlyUnreadMessages(checked === true)}
            />
            <Label htmlFor="unread-messages" className="text-sm">
              Somente mensagens não lidas
            </Label>
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="ghost" onClick={handleClear}>
              Limpar
            </Button>
            <Button 
              onClick={handleApply}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Aplicar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}