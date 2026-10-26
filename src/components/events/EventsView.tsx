import React, { useState } from 'react';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Sparkles,
  CalendarDays
} from 'lucide-react';
import { FamilyEvent } from '../../types';

interface EventsViewProps {
  events: FamilyEvent[];
  isAdmin: boolean;
  onAddEvent?: () => void;
  onEditEvent?: (event: FamilyEvent) => void;
  onDeleteEvent?: (id: string) => void;
}

export const EventsView: React.FC<EventsViewProps> = ({
  events,
  isAdmin,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
}) => {
  const [search, setSearch] = useState('');

  const filteredEvents = events.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.namaAcara.toLowerCase().includes(q) ||
      e.tempat.toLowerCase().includes(q) ||
      (e.deskripsi && e.deskripsi.toLowerCase().includes(q))
    );
  });

  const formatEventDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-serif-heritage text-stone-900">
            Agenda Silaturahmi & Acara Keluarga
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Jadwal kegiatan halal bihalal, haul, pertemuan rutin, dan ziarah Bani Nali
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari acara atau tempat..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-800 text-stone-900"
            />
          </div>

          {isAdmin && onAddEvent && (
            <button
              onClick={onAddEvent}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Acara</span>
            </button>
          )}
        </div>
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-stone-500">
          <CalendarDays className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <h3 className="text-base font-semibold text-stone-800">
            Belum Ada Acara Terjadwal
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
            Belum ada agenda keluarga baru yang disimpan di database.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((event) => (
            <div
              key={event.id}
              className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-xs hover:border-emerald-700 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 text-xs text-amber-800 font-semibold uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatEventDate(event.tanggal)}</span>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-stone-900">
                  {event.namaAcara}
                </h3>

                <div className="flex items-center gap-2 text-xs text-stone-600">
                  <MapPin className="w-4 h-4 text-emerald-800 shrink-0" />
                  <span>{event.tempat}</span>
                </div>

                {event.deskripsi && (
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed pt-1">
                    {event.deskripsi}
                  </p>
                )}
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2 self-end md:self-start pt-2 md:pt-0 border-t md:border-t-0 border-stone-100 w-full md:w-auto justify-end">
                  {onEditEvent && (
                    <button
                      onClick={() => onEditEvent(event)}
                      className="p-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
                      title="Ubah Acara"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                  {onDeleteEvent && (
                    <button
                      onClick={() => {
                        if (confirm(`Hapus acara "${event.namaAcara}"?`)) {
                          onDeleteEvent(event.id);
                        }
                      }}
                      className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 transition-colors cursor-pointer"
                      title="Hapus Acara"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
