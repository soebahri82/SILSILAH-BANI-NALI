import React, { useState, useMemo } from 'react';
import { 
  Users, 
  ArrowRightLeft, 
  Sparkles, 
  HeartHandshake, 
  HelpCircle, 
  ArrowRight,
  GitCommit,
  CheckCircle2
} from 'lucide-react';
import { FamilyMember, RelationshipResult } from '../../types';
import { calculateRelationship } from '../../utils/relationshipCalculator';
import { sortMembersByBirthDate } from '../../utils/familyTreeUtils';
import { isMale, getGenderDisplay } from '../../utils/genderUtils';

interface RelationshipCalculatorViewProps {
  members: FamilyMember[];
  onSelectMember: (m: FamilyMember) => void;
}

export const RelationshipCalculatorView: React.FC<RelationshipCalculatorViewProps> = ({
  members,
  onSelectMember,
}) => {
  // Sort members chronologically by birthDate
  const sortedMembers = useMemo(() => {
    return sortMembersByBirthDate(members, true);
  }, [members]);

  // Preset default demo IDs if available
  const [selectedIdA, setSelectedIdA] = useState<string>(() => sortedMembers[0]?.id || '');
  const [selectedIdB, setSelectedIdB] = useState<string>(() => sortedMembers[1]?.id || '');

  const memberA = useMemo(() => members.find((m) => m.id === selectedIdA) || null, [members, selectedIdA]);
  const memberB = useMemo(() => members.find((m) => m.id === selectedIdB) || null, [members, selectedIdB]);

  const calculationResult: RelationshipResult | null = useMemo(() => {
    if (!memberA || !memberB) return null;
    return calculateRelationship(memberA, memberB, members);
  }, [memberA, memberB, members]);

  const handleSwap = () => {
    const temp = selectedIdA;
    setSelectedIdA(selectedIdB);
    setSelectedIdB(temp);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-stone-200/90 shadow-xs">
        <div className="flex items-center gap-2 text-amber-800 text-xs font-semibold uppercase tracking-wider mb-2">
          <HeartHandshake className="w-4 h-4" />
          <span>Kalkulator Hubungan Silsilah Bani Nali</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold font-serif-heritage text-stone-900">
          Cek Hubungan Kekerabatan
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-stone-600 max-w-2xl leading-relaxed">
          Pilih dua anggota keluarga besar Bani Nali untuk mengetahui status hubungan darah, silsilah generasi, 
          atau pertalian pernikahan berdasarkan garis leluhur (Lowest Common Ancestor / LCA).
        </p>
      </div>

      {/* Selectors Panel */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200/90 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-11 items-center gap-4">
          {/* Selector A */}
          <div className="md:col-span-5 space-y-1.5">
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
              Pilih Orang Pertama (A)
            </label>
            <select
              value={selectedIdA}
              onChange={(e) => setSelectedIdA(e.target.value)}
              className="w-full p-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-800 text-stone-900"
            >
              {sortedMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({getGenderDisplay(m.gender)} {m.birthDate ? `· Thn ${m.birthDate.split('-')[0]}` : ''})
                </option>
              ))}
            </select>
          </div>

          {/* Swap Button */}
          <div className="md:col-span-1 flex justify-center">
            <button
              type="button"
              onClick={handleSwap}
              className="p-3 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 transition-colors cursor-pointer"
              title="Tukar Posisi"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Selector B */}
          <div className="md:col-span-5 space-y-1.5">
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
              Pilih Orang Kedua (B)
            </label>
            <select
              value={selectedIdB}
              onChange={(e) => setSelectedIdB(e.target.value)}
              className="w-full p-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-800 text-stone-900"
            >
              {sortedMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({getGenderDisplay(m.gender)} {m.birthDate ? `· Thn ${m.birthDate.split('-')[0]}` : ''})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Result Card */}
      {calculationResult && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-md overflow-hidden">
          {/* Hero Result Banner */}
          <div className="p-6 sm:p-8 bg-linear-to-br from-emerald-950 via-emerald-900 to-stone-900 text-white relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider block mb-1">
                  Hasil Perhitungan Silsilah
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold font-serif-heritage text-white">
                  {calculationResult.relationshipName}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-emerald-100/90 leading-relaxed max-w-xl">
                  {calculationResult.description}
                </p>
              </div>

              {calculationResult.commonAncestor && (
                <div className="p-3.5 rounded-xl bg-emerald-900/80 border border-emerald-700/80 text-xs text-emerald-200 shrink-0 max-w-xs">
                  <div className="font-semibold text-amber-300 flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Leluhur Pemersatu (LCA)</span>
                  </div>
                  <div className="font-medium text-white truncate">
                    {calculationResult.commonAncestor.name}
                  </div>
                  <div className="text-[10px] text-emerald-300">
                    Garis pangkal pertemuan darah keluarga
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Lineage Path Trace */}
          <div className="p-6 sm:p-8 space-y-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Rantai Garis Kekerabatan (Jalur Silsilah)
            </h4>

            <div className="flex flex-wrap items-center gap-3">
              {calculationResult.path.map((step, idx) => (
                <React.Fragment key={step.member.id}>
                  <div
                    onClick={() => onSelectMember(step.member)}
                    className="p-3 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isMale(step.member.gender)
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {step.member.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-stone-900">
                        {step.member.name}
                      </div>
                      <div className="text-[10px] text-stone-400">
                        {getGenderDisplay(step.member.gender)}
                      </div>
                    </div>
                  </div>

                  {step.relationToNext && (
                    <div className="flex flex-col items-center text-xs text-stone-400 px-1">
                      <span className="text-[10px] font-medium text-emerald-800 uppercase">
                        {step.relationToNext}
                      </span>
                      <ArrowRight className="w-4 h-4 text-stone-400" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Quick Tips */}
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600 flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-stone-800">Pedoman Kekerabatan Tradisi Nusantara:</strong>
                <p className="mt-0.5 text-stone-500">
                  Dalam adat keluarga Bani Nali, sebutan <em>Misanan</em> adalah sepupu satu kakek (1st cousin), 
                  sedangkan <em>Mindon</em> adalah sepupu satu buyut (2nd cousin). Paman/Bibi yang lebih tua dari orang tua disebut <em>Pakde/Bude</em>, 
                  sedangkan yang lebih muda disebut <em>Paklek/Buklek</em>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
