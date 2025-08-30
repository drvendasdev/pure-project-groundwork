import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Menu, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const weekDays = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export function RecursosAgendamentos() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showSidebar, setShowSidebar] = useState(true);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Add empty cells for proper calendar grid alignment
  const startPadding = monthStart.getDay();
  const paddedDays = [
    ...Array(startPadding).fill(null),
    ...daysInMonth
  ];

  const handleYearChange = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev' 
      ? new Date(currentYear - 1, currentMonth)
      : new Date(currentYear + 1, currentMonth);
    setCurrentDate(newDate);
  };

  const handleMonthSelect = (monthIndex: number) => {
    setCurrentDate(new Date(currentYear, monthIndex));
  };

  const handleDaySelect = (day: Date) => {
    setSelectedDate(day);
  };

  return (
    <div className="h-screen flex bg-gradient-to-br from-purple-100 to-purple-200">
      {/* Yellow Sidebar */}
      {showSidebar && (
        <div className="w-48 bg-gradient-to-b from-yellow-400 to-yellow-500">
          {/* Year Navigation */}
          <div className="flex items-center justify-between p-4 text-white">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleYearChange('prev')}
              className="text-white hover:bg-white/20 p-1"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="text-lg font-bold">{currentYear}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleYearChange('next')}
              className="text-white hover:bg-white/20 p-1"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Month List */}
          <div className="px-2 pb-4">
            {months.map((month, index) => (
              <button
                key={month}
                onClick={() => handleMonthSelect(index)}
                className={cn(
                  "w-full text-left px-4 py-2 text-white font-medium rounded-md mb-1 transition-colors",
                  index === currentMonth 
                    ? 'bg-yellow-600 shadow-md' 
                    : 'hover:bg-white/20'
                )}
              >
                {month}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-100 to-purple-200">
          <div className="w-10"> {/* Spacer */}</div>
          
          <h1 className="text-2xl font-bold text-yellow-600 uppercase tracking-wider">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </h1>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-yellow-600 hover:bg-white/20 p-2"
            >
              <Menu className="w-6 h-6" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-yellow-600 hover:bg-white/20 p-2"
            >
              <Calendar className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 p-6">
          {/* Week Headers */}
          <div className="grid grid-cols-7 mb-4">
            {weekDays.map(day => (
              <div key={day} className="text-center font-bold text-gray-700 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-2">
            {paddedDays.map((day, index) => (
              <div
                key={index}
                className="aspect-square flex items-center justify-center"
              >
                {day && (
                  <button
                    onClick={() => handleDaySelect(day)}
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium transition-all hover:bg-yellow-200",
                      isSameDay(day, selectedDate)
                        ? 'bg-yellow-400 text-white shadow-lg'
                        : isToday(day)
                        ? 'bg-yellow-100 text-yellow-800'
                        : day.getMonth() !== currentMonth
                        ? 'text-gray-400'
                        : 'text-gray-700 hover:text-gray-900'
                    )}
                  >
                    {day.getDate()}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}