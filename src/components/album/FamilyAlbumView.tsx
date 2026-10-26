import React, { useState, useMemo, useEffect } from 'react';
import { 
  Images, 
  Plus, 
  Download, 
  Trash2, 
  Calendar, 
  MapPin, 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Search, 
  X, 
  Upload, 
  Sparkles, 
  User, 
  AlertTriangle,
  Grid,
  Film,
  Edit3
} from 'lucide-react';
import { FamilyPhoto, UserProfile } from '../../types';
import { addPhoto, updatePhoto, deletePhoto, uploadPhotoFile } from '../../services/photoService';

interface FamilyAlbumViewProps {
  photos: FamilyPhoto[];
  user: UserProfile;
  isAdmin: boolean;
  onRefreshPhotos?: () => void;
}

export const FamilyAlbumView: React.FC<FamilyAlbumViewProps> = ({
  photos,
  user,
  isAdmin,
  onRefreshPhotos,
}) => {
  // View mode: 'grid' or 'slideshow'
  const [viewMode, setViewMode] = useState<'grid' | 'slideshow'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<string>('all');

  // Slideshow state
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Lightbox modal state (when clicking a photo in grid)
  const [lightboxPhoto, setLightboxPhoto] = useState<FamilyPhoto | null>(null);

  // Add Photo Modal State (anyone can add!)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileSizeInfo, setSelectedFileSizeInfo] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [addForm, setAddForm] = useState({
    judul: '',
    waktu: new Date().toISOString().slice(0, 10),
    tempat: '',
    deskripsi: '',
    directUrl: '',
    pengunggah: user.displayName || user.email.split('@')[0],
  });

  // Edit Photo Modal State (ADMIN only)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<FamilyPhoto | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editStatus, setEditStatus] = useState<string>('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editFileSizeInfo, setEditFileSizeInfo] = useState<string>('');
  const [editPreviewUrl, setEditPreviewUrl] = useState<string>('');
  const [editForm, setEditForm] = useState({
    judul: '',
    waktu: '',
    tempat: '',
    deskripsi: '',
    directUrl: '',
    uploadedBy: '',
  });

  // Delete Confirmation Modal State (ADMIN only)
  const [photoToDelete, setPhotoToDelete] = useState<FamilyPhoto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Unique places for filtering
  const placesList = useMemo(() => {
    const set = new Set<string>();
    photos.forEach((p) => {
      if (p.tempat && p.tempat.trim()) {
        set.add(p.tempat.trim());
      }
    });
    return Array.from(set);
  }, [photos]);

  // Filtered photos
  const filteredPhotos = useMemo(() => {
    return photos.filter((p) => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTitle = (p.judul || '').toLowerCase().includes(q);
        const matchPlace = (p.tempat || '').toLowerCase().includes(q);
        const matchDesc = (p.deskripsi || '').toLowerCase().includes(q);
        const matchUploader = (p.uploadedBy || '').toLowerCase().includes(q);
        if (!matchTitle && !matchPlace && !matchDesc && !matchUploader) return false;
      }
      if (selectedPlace !== 'all' && p.tempat !== selectedPlace) {
        return false;
      }
      return true;
    });
  }, [photos, searchTerm, selectedPlace]);

  // Slideshow auto-advance
  useEffect(() => {
    if (viewMode !== 'slideshow' || !isPlaying || filteredPhotos.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % filteredPhotos.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [viewMode, isPlaying, filteredPhotos.length]);

  // Keep slide index in bounds
  useEffect(() => {
    if (currentSlideIndex >= filteredPhotos.length && filteredPhotos.length > 0) {
      setCurrentSlideIndex(0);
    }
  }, [filteredPhotos.length, currentSlideIndex]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxPhoto) {
        if (e.key === 'Escape') setLightboxPhoto(null);
        if (e.key === 'ArrowRight') {
          const idx = filteredPhotos.findIndex((p) => p.id === lightboxPhoto.id);
          if (idx !== -1 && idx < filteredPhotos.length - 1) {
            setLightboxPhoto(filteredPhotos[idx + 1]);
          }
        }
        if (e.key === 'ArrowLeft') {
          const idx = filteredPhotos.findIndex((p) => p.id === lightboxPhoto.id);
          if (idx > 0) {
            setLightboxPhoto(filteredPhotos[idx - 1]);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxPhoto, filteredPhotos]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      const sizeKb = Math.round(file.size / 1024);
      setSelectedFileSizeInfo(
        file.size > 1024 * 1024
          ? `${sizeMb} MB (otomatis dikompresi cepat)`
          : `${sizeKb} KB (siap simpan)`
      );
    }
  };

  // Download photo function
  const handleDownloadPhoto = async (photo: FamilyPhoto) => {
    try {
      const response = await fetch(photo.photoURL);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const cleanTitle = (photo.judul || 'Foto_Bani_Nali').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `BaniNali_${cleanTitle}_${photo.waktu || 'album'}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback direct link
      window.open(photo.photoURL, '_blank');
    }
  };

  // Save new photo
  const handleSavePhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.judul.trim()) {
      setToastMessage({ type: 'error', text: 'Mohon isi judul foto.' });
      return;
    }
    if (!selectedFile && !addForm.directUrl.trim()) {
      setToastMessage({ type: 'error', text: 'Mohon pilih file foto atau masukkan tautan URL foto.' });
      return;
    }

    setIsSubmitting(true);
    setUploadStatus('Mengoptimalkan & mengompresi foto...');
    try {
      let finalUrl = addForm.directUrl.trim();
      if (selectedFile) {
        finalUrl = await uploadPhotoFile(selectedFile, (status) => setUploadStatus(status));
      }

      setUploadStatus('Menyimpan ke album foto...');
      await addPhoto({
        judul: addForm.judul.trim(),
        waktu: addForm.waktu || new Date().toISOString().slice(0, 10),
        tempat: addForm.tempat.trim() || 'Lokasi tidak dicatat',
        deskripsi: addForm.deskripsi.trim(),
        photoURL: finalUrl,
        uploadedBy: addForm.pengunggah.trim() || user.displayName || user.email,
        uploadedByUid: user.uid,
      });

      setToastMessage({ type: 'success', text: `Foto "${addForm.judul}" berhasil disimpan ke album!` });
      setIsAddModalOpen(false);
      setSelectedFile(null);
      setSelectedFileSizeInfo('');
      setPreviewUrl('');
      setUploadStatus('');
      setAddForm({
        judul: '',
        waktu: new Date().toISOString().slice(0, 10),
        tempat: '',
        deskripsi: '',
        directUrl: '',
        pengunggah: user.displayName || user.email.split('@')[0],
      });
      if (onRefreshPhotos) onRefreshPhotos();
    } catch (err: unknown) {
      setToastMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menambahkan foto.' });
    } finally {
      setIsSubmitting(false);
      setUploadStatus('');
    }
  };

  // Open Edit Photo Modal (ADMIN only)
  const handleOpenEditModal = (photo: FamilyPhoto) => {
    setEditingPhoto(photo);
    setEditForm({
      judul: photo.judul || '',
      waktu: photo.waktu || '',
      tempat: photo.tempat || '',
      deskripsi: photo.deskripsi || '',
      directUrl: photo.photoURL || '',
      uploadedBy: photo.uploadedBy || '',
    });
    setEditFile(null);
    setEditFileSizeInfo('');
    setEditStatus('');
    setEditPreviewUrl(photo.photoURL || '');
    setIsEditModalOpen(true);
  };

  // Handle edit file change
  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditFile(file);
      const url = URL.createObjectURL(file);
      setEditPreviewUrl(url);
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      const sizeKb = Math.round(file.size / 1024);
      setEditFileSizeInfo(
        file.size > 1024 * 1024
          ? `${sizeMb} MB (otomatis dikompresi cepat)`
          : `${sizeKb} KB (siap simpan)`
      );
    }
  };

  // Save edited photo (ADMIN only)
  const handleSaveEditPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPhoto) return;
    if (!editForm.judul.trim()) {
      setToastMessage({ type: 'error', text: 'Mohon isi judul foto.' });
      return;
    }

    setIsUpdating(true);
    setEditStatus('Mengoptimalkan foto...');
    try {
      let finalUrl = editForm.directUrl.trim() || editingPhoto.photoURL;
      if (editFile) {
        finalUrl = await uploadPhotoFile(editFile, (status) => setEditStatus(status));
      }

      setEditStatus('Menyimpan perubahan foto...');
      await updatePhoto(editingPhoto.id, {
        judul: editForm.judul.trim(),
        waktu: editForm.waktu.trim() || editingPhoto.waktu,
        tempat: editForm.tempat.trim() || editingPhoto.tempat,
        deskripsi: editForm.deskripsi.trim(),
        photoURL: finalUrl,
        uploadedBy: editForm.uploadedBy.trim() || editingPhoto.uploadedBy,
      });

      setToastMessage({ type: 'success', text: `Foto "${editForm.judul}" berhasil diperbarui!` });
      setIsEditModalOpen(false);
      setEditingPhoto(null);
      setEditFile(null);
      setEditFileSizeInfo('');
      setEditPreviewUrl('');
      setEditStatus('');

      if (lightboxPhoto && lightboxPhoto.id === editingPhoto.id) {
        setLightboxPhoto({
          ...lightboxPhoto,
          judul: editForm.judul.trim(),
          waktu: editForm.waktu.trim() || editingPhoto.waktu,
          tempat: editForm.tempat.trim() || editingPhoto.tempat,
          deskripsi: editForm.deskripsi.trim(),
          photoURL: finalUrl,
          uploadedBy: editForm.uploadedBy.trim() || editingPhoto.uploadedBy,
        });
      }
      if (onRefreshPhotos) onRefreshPhotos();
    } catch (err: unknown) {
      setToastMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal memperbarui foto.' });
    } finally {
      setIsUpdating(false);
      setEditStatus('');
    }
  };

  // Confirm delete photo (ADMIN only)
  const handleConfirmDeletePhoto = async () => {
    if (!photoToDelete) return;
    setIsDeleting(true);
    try {
      await deletePhoto(photoToDelete.id);
      setToastMessage({ type: 'success', text: `Foto "${photoToDelete.judul}" berhasil dihapus dari album.` });
      setPhotoToDelete(null);
      if (lightboxPhoto?.id === photoToDelete.id) {
        setLightboxPhoto(null);
      }
      if (onRefreshPhotos) onRefreshPhotos();
    } catch (err: unknown) {
      setToastMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menghapus foto.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const currentSlide = filteredPhotos[currentSlideIndex];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : 'bg-red-900 text-white border-red-700'
          }`}
        >
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-white/70 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-stone-900 text-white rounded-3xl p-6 sm:p-8 border border-stone-800 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
              <Images className="w-4 h-4" />
              <span>Dokumentasi Visual Trah</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif-heritage font-bold">
              Album Foto Keluarga Bani Nali
            </h2>
            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
              Koleksi momen bersejarah, silaturahmi akbar, halal bihalal, dan ziarah keluarga. 
              Siapapun anggota keluarga dapat mengabadikan kenangan dengan menambahkan foto ke dalam album.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle: Grid vs Slideshow */}
            <div className="bg-stone-800/80 p-1 rounded-xl border border-stone-700 flex items-center gap-1 shadow-inner">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-stone-400 hover:text-white hover:bg-stone-700/60'
                }`}
                title="Tampilan Galeri Grid"
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Grid</span>
              </button>
              <button
                onClick={() => setViewMode('slideshow')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'slideshow'
                    ? 'bg-amber-600 text-stone-950 shadow-xs'
                    : 'text-stone-400 hover:text-white hover:bg-stone-700/60'
                }`}
                title="Tampilan Slide / Presentasi Foto"
              >
                <Film className="w-3.5 h-3.5" />
                <span>Slide Foto</span>
              </button>
            </div>

            {/* Menu Tambah Foto (Siapapun bisa menambahkan) */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Foto</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari judul, tempat, pengunggah..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-stone-500 font-medium shrink-0">Lokasi:</span>
          <select
            value={selectedPlace}
            onChange={(e) => setSelectedPlace(e.target.value)}
            className="text-xs bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800"
          >
            <option value="all">Semua Lokasi ({photos.length})</option>
            {placesList.map((place) => (
              <option key={place} value={place}>
                {place}
              </option>
            ))}
          </select>

          <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200 shrink-0">
            {filteredPhotos.length} Foto
          </span>
        </div>
      </div>

      {/* VIEW MODE 1: SLIDESHOW PRESENTATION */}
      {viewMode === 'slideshow' && (
        <div className="space-y-4">
          {filteredPhotos.length === 0 ? (
            <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center text-stone-500">
              <Images className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-stone-700">Tidak ada foto yang sesuai dengan filter.</p>
            </div>
          ) : (
            <div className="bg-stone-950 rounded-3xl border border-stone-800 overflow-hidden shadow-2xl relative">
              {/* Main Slide Image Display */}
              <div className="relative h-[380px] sm:h-[480px] md:h-[560px] w-full flex items-center justify-center bg-black/90 group">
                <img
                  key={currentSlide.id}
                  src={currentSlide.photoURL}
                  alt={currentSlide.judul}
                  className="max-h-full max-w-full object-contain select-none transition-all duration-500 animate-in fade-in"
                />

                {/* Left Navigation Arrow */}
                <button
                  onClick={() =>
                    setCurrentSlideIndex((prev) => (prev === 0 ? filteredPhotos.length - 1 : prev - 1))
                  }
                  className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 flex items-center justify-center transition-all cursor-pointer opacity-80 hover:opacity-100"
                  title="Foto Sebelumnya"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                {/* Right Navigation Arrow */}
                <button
                  onClick={() =>
                    setCurrentSlideIndex((prev) => (prev + 1) % filteredPhotos.length)
                  }
                  className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 flex items-center justify-center transition-all cursor-pointer opacity-80 hover:opacity-100"
                  title="Foto Berikutnya"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>

                {/* Top Overlay Bar: Slide Counter & Actions */}
                <div className="absolute top-4 inset-x-4 sm:inset-x-6 flex items-center justify-between text-white text-xs">
                  <div className="bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 font-medium">
                    Slide {currentSlideIndex + 1} dari {filteredPhotos.length}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Autoplay / Pause Button */}
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className={`px-3 py-1.5 rounded-full backdrop-blur-md border flex items-center gap-1.5 font-medium transition-all cursor-pointer ${
                        isPlaying
                          ? 'bg-amber-500 text-stone-950 border-amber-400'
                          : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
                      }`}
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isPlaying ? 'Jeda' : 'Otomatis'}</span>
                    </button>

                    {/* Download Button */}
                    <button
                      onClick={() => handleDownloadPhoto(currentSlide)}
                      className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer"
                      title="Unduh Foto Resolusi Penuh"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {/* Fullscreen Lightbox Button */}
                    <button
                      onClick={() => setLightboxPhoto(currentSlide)}
                      className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer"
                      title="Lihat Layar Penuh"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit Button (ADMIN only) */}
                    {isAdmin && (
                      <button
                        onClick={() => handleOpenEditModal(currentSlide)}
                        className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer"
                        title="Sunting Foto Ini (Khusus Admin)"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-300" />
                      </button>
                    )}

                    {/* Delete Button (ADMIN only) */}
                    {isAdmin && (
                      <button
                        onClick={() => setPhotoToDelete(currentSlide)}
                        className="p-2 rounded-full bg-red-900/70 hover:bg-red-800 text-white backdrop-blur-md border border-red-500/40 transition-all cursor-pointer"
                        title="Hapus Foto Ini (Khusus Admin)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Bottom Overlay: Title, Place, Date & Description */}
                <div className="absolute bottom-0 inset-x-0 p-4 sm:p-6 bg-gradient-to-t from-stone-950 via-stone-950/80 to-transparent text-white">
                  <div className="max-w-3xl space-y-1.5">
                    <h3 className="text-base sm:text-xl font-bold font-serif-heritage drop-shadow-sm">
                      {currentSlide.judul}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-300">
                      <span className="flex items-center gap-1 text-amber-300 font-medium">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{currentSlide.waktu}</span>
                      </span>
                      {currentSlide.tempat && (
                        <span className="flex items-center gap-1 text-emerald-300 font-medium">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{currentSlide.tempat}</span>
                        </span>
                      )}
                      {currentSlide.uploadedBy && (
                        <span className="text-stone-400 text-[11px] flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>Oleh: {currentSlide.uploadedBy}</span>
                        </span>
                      )}
                    </div>
                    {currentSlide.deskripsi && (
                      <p className="text-xs sm:text-sm text-stone-200/90 leading-relaxed pt-1">
                        {currentSlide.deskripsi}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Thumbnails Strip at Bottom of Slideshow */}
              <div className="p-3 bg-stone-900 border-t border-stone-800 flex items-center gap-2 overflow-x-auto scrollbar-thin">
                {filteredPhotos.map((p, idx) => (
                  <button
                    key={p.id}
                    onClick={() => setCurrentSlideIndex(idx)}
                    className={`relative w-16 h-12 sm:w-20 sm:h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                      idx === currentSlideIndex
                        ? 'border-amber-400 scale-105 shadow-md ring-2 ring-amber-400/30'
                        : 'border-transparent opacity-50 hover:opacity-80'
                    }`}
                  >
                    <img src={p.photoURL} alt={p.judul} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: RESPONSIVE GRID / MASONRY CARDS */}
      {viewMode === 'grid' && (
        <>
          {filteredPhotos.length === 0 ? (
            <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center text-stone-500 shadow-xs">
              <Images className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-stone-800">Album Foto Belum Berisi Foto</h3>
              <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
                Mulai abadikan momen keluarga dengan menekan tombol &quot;Tambah Foto&quot; di atas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {filteredPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group"
                >
                  {/* Photo Container */}
                  <div
                    onClick={() => setLightboxPhoto(photo)}
                    className="relative aspect-4/3 overflow-hidden bg-stone-100 cursor-pointer"
                  >
                    <img
                      src={photo.photoURL}
                      alt={photo.judul}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Gradient Overlay for hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <span className="text-[11px] font-medium text-white flex items-center gap-1.5">
                        <Maximize2 className="w-3.5 h-3.5 text-amber-300" />
                        <span>Klik untuk memperbesar</span>
                      </span>
                    </div>

                    {/* Badges on Top */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                      <span className="px-2 py-0.5 rounded-full bg-stone-900/80 backdrop-blur-md text-[10px] font-semibold text-amber-300 border border-white/20">
                        {photo.waktu}
                      </span>

                      {/* Admin Action Buttons (Edit & Delete) */}
                      {isAdmin && (
                        <div className="flex items-center gap-1 pointer-events-auto">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(photo);
                            }}
                            className="p-1.5 rounded-full bg-stone-900/85 hover:bg-stone-800 text-amber-300 border border-white/20 shadow-xs transition-colors cursor-pointer"
                            title="Sunting Foto (Admin)"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPhotoToDelete(photo);
                            }}
                            className="p-1.5 rounded-full bg-red-600/90 hover:bg-red-700 text-white shadow-xs transition-colors cursor-pointer"
                            title="Hapus Foto (Admin)"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Photo Metadata Details */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <h4 className="font-serif-heritage font-bold text-sm text-stone-900 line-clamp-1">
                        {photo.judul}
                      </h4>
                      {photo.tempat && (
                        <div className="flex items-center gap-1 text-[11px] text-stone-500">
                          <MapPin className="w-3 h-3 text-emerald-800 shrink-0" />
                          <span className="truncate">{photo.tempat}</span>
                        </div>
                      )}
                      {photo.deskripsi && (
                        <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed pt-1">
                          {photo.deskripsi}
                        </p>
                      )}
                    </div>

                    {/* Footer Actions: Uploader info & Download / Edit */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
                      <span className="truncate max-w-[110px]">
                        Oleh: {photo.uploadedBy || 'Keluarga'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenEditModal(photo)}
                            className="p-1.5 rounded-lg text-amber-800 hover:text-amber-900 hover:bg-amber-50 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                            title="Sunting Foto (Admin)"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleDownloadPhoto(photo)}
                          className="p-1.5 rounded-lg text-stone-600 hover:text-emerald-800 hover:bg-stone-100 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                          title="Unduh Foto Ini"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Unduh</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* LIGHTBOX / FULL-SCREEN PHOTO PREVIEW MODAL */}
      {lightboxPhoto && (
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-950/90 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-stone-900 rounded-3xl overflow-hidden border border-stone-700 shadow-2xl max-w-5xl w-full flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
          >
            {/* Lightbox Header */}
            <div className="p-4 bg-stone-950 border-b border-stone-800 flex items-center justify-between text-white">
              <div className="space-y-0.5">
                <h3 className="font-serif-heritage font-bold text-base sm:text-lg">
                  {lightboxPhoto.judul}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-stone-400">
                  <span className="flex items-center gap-1 text-amber-300">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{lightboxPhoto.waktu}</span>
                  </span>
                  {lightboxPhoto.tempat && (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{lightboxPhoto.tempat}</span>
                    </span>
                  )}
                  {lightboxPhoto.uploadedBy && (
                    <span>Oleh: {lightboxPhoto.uploadedBy}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPhoto(lightboxPhoto)}
                  className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Unduh Foto Asli"
                >
                  <Download className="w-3.5 h-3.5 text-amber-300" />
                  <span>Unduh</span>
                </button>

                {isAdmin && (
                  <button
                    onClick={() => handleOpenEditModal(lightboxPhoto)}
                    className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                    title="Sunting Foto Ini (Admin)"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-300" />
                    <span>Edit</span>
                  </button>
                )}

                {isAdmin && (
                  <button
                    onClick={() => {
                      setPhotoToDelete(lightboxPhoto);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-red-900/60 hover:bg-red-800 text-white text-xs font-semibold flex items-center gap-1.5 border border-red-500/30 transition-colors cursor-pointer"
                    title="Hapus Foto Ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                )}

                <button
                  onClick={() => setLightboxPhoto(null)}
                  className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Tutup (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Photo Preview Container */}
            <div className="p-3 sm:p-5 overflow-auto flex items-center justify-center bg-black/70 flex-1">
              <img
                src={lightboxPhoto.photoURL}
                alt={lightboxPhoto.judul}
                className="rounded-xl max-h-[70vh] w-auto object-contain shadow-2xl"
              />
            </div>

            {/* Lightbox Footer Caption */}
            {lightboxPhoto.deskripsi && (
              <div className="p-4 bg-stone-950 border-t border-stone-800 text-xs text-stone-300 leading-relaxed text-center">
                {lightboxPhoto.deskripsi}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD PHOTO MODAL (Accessible by ALL users) */}
      {isAddModalOpen && (
        <div
          onClick={() => !isSubmitting && setIsAddModalOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 md:p-6 bg-stone-900/60 backdrop-blur-xs overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-xl overflow-hidden my-4 relative shrink-0 animate-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="p-5 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Images className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-base font-serif-heritage">
                    Tambah Foto ke Album Keluarga
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Semua anggota keluarga dapat menambahkan dokumentasi kenangan
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSavePhoto} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-800 mb-1">
                  Judul / Nama Foto *
                </label>
                <input
                  type="text"
                  required
                  value={addForm.judul}
                  onChange={(e) => setAddForm({ ...addForm, judul: e.target.value })}
                  placeholder="Contoh: Silaturahmi Lebaran di Pasuruan, Haul Akbar 2026"
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-800 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-800 mb-1">
                    Waktu / Tanggal Pengambilan Foto *
                  </label>
                  <input
                    type="date"
                    required
                    value={addForm.waktu}
                    onChange={(e) => setAddForm({ ...addForm, waktu: e.target.value })}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-800 mb-1">
                    Tempat / Lokasi *
                  </label>
                  <input
                    type="text"
                    required
                    value={addForm.tempat}
                    onChange={(e) => setAddForm({ ...addForm, tempat: e.target.value })}
                    placeholder="Contoh: Pasuruan, Kediaman Surabaya"
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-800 focus:outline-none"
                  />
                </div>
              </div>

              {/* Photo Upload or Direct URL */}
              <div className="space-y-2">
                <label className="block font-semibold text-stone-800">
                  Pilih File Foto *
                </label>

                {previewUrl ? (
                  <div className="relative aspect-16/9 rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
                    <img src={previewUrl} alt="Pratinjau" className="w-full h-full object-contain" />
                    {selectedFileSizeInfo && (
                      <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-stone-900/80 backdrop-blur-xs text-white text-[11px] font-medium rounded-lg flex items-center gap-1.5 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>{selectedFileSizeInfo}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setSelectedFileSizeInfo('');
                        setPreviewUrl('');
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xs cursor-pointer"
                      title="Ganti Foto"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-stone-300 hover:border-emerald-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-stone-50/50 hover:bg-emerald-50/30">
                    <Upload className="w-8 h-8 text-emerald-800 mb-2" />
                    <span className="font-semibold text-stone-700">Klik untuk memilih file gambar</span>
                    <span className="text-[11px] text-stone-400 mt-0.5">JPG, PNG, WebP (otomatis dioptimalkan cepat)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-stone-200" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-white px-2 text-stone-400">Atau masukkan URL gambar langsung</span>
                  </div>
                </div>

                <input
                  type="url"
                  value={addForm.directUrl}
                  onChange={(e) => setAddForm({ ...addForm, directUrl: e.target.value })}
                  placeholder="https://... (tautan gambar)"
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-800 mb-1">
                  Keterangan / Catatan Foto (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={addForm.deskripsi}
                  onChange={(e) => setAddForm({ ...addForm, deskripsi: e.target.value })}
                  placeholder="Catatan peristiwa, siapa saja yang hadir, atau cerita di balik foto..."
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-800 mb-1">
                  Nama Pengunggah
                </label>
                <input
                  type="text"
                  value={addForm.pengunggah}
                  onChange={(e) => setAddForm({ ...addForm, pengunggah: e.target.value })}
                  placeholder="Nama Anda"
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-800 focus:outline-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-stone-100">
                <div className="text-xs text-stone-500 w-full sm:w-auto text-center sm:text-left">
                  {isSubmitting && uploadStatus ? (
                    <span className="inline-flex items-center gap-2 text-emerald-800 font-semibold animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                      {uploadStatus}
                    </span>
                  ) : (
                    <span className="text-stone-400 text-[11px]">Foto otomatis dioptimalkan agar cepat disimpan</span>
                  )}
                </div>
                <div className="flex justify-end gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-semibold cursor-pointer disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 min-w-[140px]"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Simpan ke Album</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE PHOTO CONFIRMATION MODAL (ADMIN only) */}
      {photoToDelete && (
        <div
          onClick={() => !isDeleting && setPhotoToDelete(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
          >
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shadow-inner">
                <Trash2 className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold font-serif-heritage text-stone-900">
                  Konfirmasi Hapus Foto (Admin)
                </h3>
                <p className="text-sm font-medium text-stone-700 leading-relaxed">
                  Apakah yakin akan menghapus foto <span className="font-bold text-red-700 underline underline-offset-2">&quot;{photoToDelete.judul}&quot;</span> dari Album Foto Keluarga?
                </p>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-left text-xs text-stone-600 space-y-1">
                <div className="flex justify-between">
                  <span className="text-stone-400">Waktu:</span>
                  <span className="text-stone-800">{photoToDelete.waktu}</span>
                </div>
                {photoToDelete.tempat && (
                  <div className="flex justify-between">
                    <span className="text-stone-400">Tempat:</span>
                    <span className="text-stone-800">{photoToDelete.tempat}</span>
                  </div>
                )}
                {photoToDelete.uploadedBy && (
                  <div className="flex justify-between">
                    <span className="text-stone-400">Pengunggah:</span>
                    <span className="text-stone-800">{photoToDelete.uploadedBy}</span>
                  </div>
                )}
                <p className="text-[11px] text-red-600 pt-1.5 border-t border-stone-200 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Foto akan dihapus permanen dari basis data album keluarga.</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setPhotoToDelete(null)}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDeletePhoto}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Ya, Hapus Foto</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PHOTO MODAL (ADMIN ONLY) */}
      {isEditModalOpen && editingPhoto && (
        <div
          onClick={() => !isUpdating && setIsEditModalOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 md:p-6 bg-stone-900/60 backdrop-blur-xs overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-xl overflow-hidden my-4 relative shrink-0 animate-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="p-5 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-base font-serif-heritage">
                    Sunting Informasi Foto (Admin)
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    ID: {editingPhoto.id} · Perbarui judul, waktu, tempat, atau file gambar
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEditPhoto} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-800 mb-1">
                  Judul Foto *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.judul}
                  onChange={(e) => setEditForm({ ...editForm, judul: e.target.value })}
                  placeholder="Judul foto..."
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-800 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-800 mb-1">
                    Waktu / Tanggal *
                  </label>
                  <input
                    type="date"
                    required
                    value={editForm.waktu}
                    onChange={(e) => setEditForm({ ...editForm, waktu: e.target.value })}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-800 mb-1">
                    Tempat / Lokasi *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.tempat}
                    onChange={(e) => setEditForm({ ...editForm, tempat: e.target.value })}
                    placeholder="Lokasi foto..."
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-800 focus:outline-none"
                  />
                </div>
              </div>

              {/* Current Photo & Change Option */}
              <div className="space-y-2">
                <label className="block font-semibold text-stone-800">
                  Foto Saat Ini &amp; Opsi Ganti
                </label>

                {editPreviewUrl && (
                  <div className="relative aspect-16/9 rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
                    <img src={editPreviewUrl} alt="Pratinjau" className="w-full h-full object-contain" />
                    {editFile && (
                      <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-stone-900/80 backdrop-blur-xs text-white text-[11px] font-medium rounded-lg flex items-center gap-1.5 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>{editFileSizeInfo || 'File baru dipilih'}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-1">
                  <label className="flex-1 py-2 px-3 border border-stone-300 hover:border-emerald-700 bg-stone-50 hover:bg-stone-100 rounded-xl text-center cursor-pointer text-stone-700 font-semibold flex items-center justify-center gap-1.5 transition-colors">
                    <Upload className="w-3.5 h-3.5 text-emerald-800" />
                    <span>Pilih Berkas Foto Baru</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="pt-1">
                  <label className="block text-stone-600 font-medium mb-1 text-[11px]">
                    Atau perbarui tautan URL foto langsung:
                  </label>
                  <input
                    type="text"
                    value={editForm.directUrl}
                    onChange={(e) => {
                      setEditForm({ ...editForm, directUrl: e.target.value });
                      setEditPreviewUrl(e.target.value);
                    }}
                    placeholder="https://... atau /assets/..."
                    className="w-full p-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-800 focus:outline-none font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-800 mb-1">
                  Keterangan / Catatan Foto
                </label>
                <textarea
                  rows={2}
                  value={editForm.deskripsi}
                  onChange={(e) => setEditForm({ ...editForm, deskripsi: e.target.value })}
                  placeholder="Catatan peristiwa atau cerita di balik foto..."
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-800 mb-1">
                  Nama Pengunggah / Pencatat
                </label>
                <input
                  type="text"
                  value={editForm.uploadedBy}
                  onChange={(e) => setEditForm({ ...editForm, uploadedBy: e.target.value })}
                  placeholder="Nama pengunggah..."
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:ring-2 focus:ring-emerald-800 focus:outline-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-stone-100">
                <div className="text-xs text-stone-500 w-full sm:w-auto text-center sm:text-left">
                  {isUpdating && editStatus ? (
                    <span className="inline-flex items-center gap-2 text-emerald-800 font-semibold animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                      {editStatus}
                    </span>
                  ) : (
                    <span className="text-stone-400 text-[11px]">Foto otomatis dioptimalkan agar cepat disimpan</span>
                  )}
                </div>
                <div className="flex justify-end gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-semibold cursor-pointer disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 min-w-[140px]"
                  >
                    {isUpdating ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Edit3 className="w-4 h-4" />
                        <span>Simpan Perubahan</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
