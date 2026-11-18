// The LOG tab: your surf journal. Log sessions after you surf, and see your stats build up.
// Everything here lives on the phone only.
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { BOARDS, byMonth, dayLabel, monthLabel, newId, Session, stats, todayISO } from '../engine/journal';
import { fx } from '../sound';
import { useStore } from '../store';
import { C, PX } from '../theme';
import { Box, Divider, Heading, Icon, PButton, Press, T } from '../ui/kit';
import { Stars, StatTile } from '../ui/extra';

const SIZES = ['Flat', '1-2 ft', '2-3 ft', '3-4 ft', '4-6 ft', '6-8 ft', '8-10 ft', '10 ft+'];
const sizeToFt = [0.5, 1.5, 2.5, 3.5, 5, 7, 9, 12];
const ftToSize = (ft: number) => { let b = 0; for (let i = 0; i < sizeToFt.length; i++) if (Math.abs(sizeToFt[i] - ft) < Math.abs(sizeToFt[b] - ft)) b = i; return b; };

export function JournalScreen() {
  const s = useStore();
  const [editing, setEditing] = useState<Session | null>(null);
  const [adding, setAdding] = useState(false);
  const st = useMemo(() => stats(s.journal), [s.journal]);
  const groups = useMemo(() => byMonth(s.journal), [s.journal]);

  const openNew = () => {
    fx.select();
    setEditing({
      id: newId(), date: todayISO(), spot: s.spot?.name || '', region: s.spot?.region || '',
      stars: 4, sizeFt: s.status ? 3 : 3, board: 'shortboard', notes: '',
    });
    setAdding(true);
  };
  const openEdit = (sess: Session) => { fx.tap(); setEditing(sess); setAdding(false); };

  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 34 }}>
      <Heading style={{ marginTop: 6 }}>MY SURF LOG</Heading>

      {st.total === 0 ? (
        <Box bg={C.cream} pad={16}>
          <T px size={11}>NO SESSIONS YET</T>
          <T size={24} style={{ marginTop: 8 }}>Log every surf and watch your stats, streaks and favourite spots build up over time.</T>
          <PButton label="+ LOG YOUR FIRST SESSION" style={{ marginTop: 14 }} onPress={openNew} />
        </Box>
      ) : (
        <>
          {/* headline stats */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatTile label="SESSIONS" value={String(st.total)} bg={C.foam} />
            <StatTile label="THIS MONTH" value={String(st.thisMonth)} bg={C.foam} />
            <StatTile label="DAY STREAK" value={String(st.streak)} bg={st.streak >= 2 ? C.sun : C.foam} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <StatTile label="AVG RATING" value={st.avgStars.toFixed(1) + '★'} bg={C.foam} />
            <StatTile label="SPOTS SURFED" value={String(st.distinctSpots)} bg={C.foam} />
            <StatTile label="TOP SPOT" value={st.topSpot ? '×' + st.topSpot.count : '-'} sub={st.topSpot?.name} bg={C.foam} />
          </View>
          {st.best ? (
            <Box bg={C.cream} pad={12} style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="star" size={18} color={C.coral} />
                <T px size={8} color={C.inkSoft}>BEST SESSION</T>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <T size={26} numberOfLines={1}>{st.best.spot}</T>
                  <T size={19} color={C.inkSoft}>{dayLabel(st.best.date)} · {SIZES[ftToSize(st.best.sizeFt)]}</T>
                </View>
                <Stars value={st.best.stars} size={20} />
              </View>
            </Box>
          ) : null}
          <PButton label="+ LOG A SESSION" style={{ marginTop: 14 }} onPress={openNew} />

          {groups.map((g) => (
            <View key={g.month}>
              <T px size={9} color={C.seaDeep} style={{ marginTop: 20, marginBottom: 10 }}>{monthLabel(g.month + '-01').toUpperCase()}</T>
              <Box pad={0}>
                {g.items.map((sess, i) => (
                  <View key={sess.id}>
                    {i ? <Divider /> : null}
                    <Press label={'Edit session at ' + sess.spot} onPress={() => openEdit(sess)}
                      style={{ padding: 12, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <T size={25} numberOfLines={1} style={{ flex: 1 }}>{sess.spot || 'A surf'}</T>
                        <Stars value={sess.stars} size={17} />
                      </View>
                      <T size={19} color={C.inkSoft}>{dayLabel(sess.date)} · {SIZES[ftToSize(sess.sizeFt)]} · {BOARDS.find((b) => b.key === sess.board)?.label || sess.board}</T>
                      {sess.notes ? <T size={20} numberOfLines={2}>{sess.notes}</T> : null}
                    </Press>
                  </View>
                ))}
              </Box>
            </View>
          ))}
        </>
      )}

      {editing ? (
        <SessionForm
          key={editing.id}
          session={editing}
          isNew={adding}
          onClose={() => setEditing(null)}
          onSave={(sess) => { if (adding) s.addSession(sess); else s.updateSession(sess); fx.select(); setEditing(null); }}
          onDelete={() => { s.deleteSession(editing.id); fx.back(); setEditing(null); }}
        />
      ) : null}
    </ScrollView>
  );
}

function SessionForm({ session, isNew, onClose, onSave, onDelete }: {
  session: Session; isNew: boolean; onClose: () => void; onSave: (s: Session) => void; onDelete: () => void;
}) {
  const [spot, setSpot] = useState(session.spot);
  const [stars, setStars] = useState(session.stars);
  const [sizeI, setSizeI] = useState(ftToSize(session.sizeFt));
  const [board, setBoard] = useState(session.board);
  const [notes, setNotes] = useState(session.notes);

  const save = () => onSave({ ...session, spot: spot.trim() || 'A surf', stars, sizeFt: sizeToFt[sizeI], board, notes: notes.trim() });

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.aqua }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: C.sea, borderBottomWidth: PX, borderColor: C.ink }}>
          <PButton label="CLOSE" size={9} pad={9} bg={C.white} onPress={() => { fx.back(); onClose(); }} />
          <T px size={12} color={C.white} style={{ flex: 1 }}>{isNew ? 'NEW SESSION' : 'EDIT SESSION'}</T>
          <PButton label="SAVE" size={9} pad={9} onPress={save} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
          <Label>SPOT</Label>
          <Field value={spot} onChangeText={setSpot} placeholder="Where did you surf?" />

          <Label>HOW GOOD WAS IT?</Label>
          <View style={{ alignItems: 'center', paddingVertical: 6 }}>
            <Stars value={stars} size={40} onChange={(v) => { fx.tap(); setStars(v); }} />
          </View>

          <Label>WAVE SIZE</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SIZES.map((sz, i) => (
              <Pressable key={sz} accessibilityRole="button" accessibilityState={{ selected: i === sizeI }} onPress={() => { fx.tap(); setSizeI(i); }}>
                <Box bg={i === sizeI ? C.sun : C.white} pad={2} shadow={i === sizeI}>
                  <View style={{ paddingHorizontal: 10, minHeight: 40, justifyContent: 'center' }}><T size={21}>{sz}</T></View>
                </Box>
              </Pressable>
            ))}
          </View>

          <Label>BOARD</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {BOARDS.map((b) => (
              <Pressable key={b.key} accessibilityRole="button" accessibilityState={{ selected: b.key === board }} onPress={() => { fx.tap(); setBoard(b.key); }}>
                <Box bg={b.key === board ? C.sun : C.white} pad={2} shadow={b.key === board}>
                  <View style={{ paddingHorizontal: 10, minHeight: 40, justifyContent: 'center' }}><T size={21}>{b.label}</T></View>
                </Box>
              </Pressable>
            ))}
          </View>

          <Label>NOTES</Label>
          <Field value={notes} onChangeText={setNotes} placeholder="Crowd, tide, how you felt..." multiline />

          {!isNew ? (
            <Press label="Delete this session" onPress={onDelete} style={{ marginTop: 24, alignItems: 'center', paddingVertical: 10 }}>
              <T size={21} color={C.poor}>Delete this session</T>
            </Press>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Label({ children }: { children: string }) {
  return <T px size={9} color={C.seaDeep} style={{ marginTop: 18, marginBottom: 8 }}>{children}</T>;
}
function Field({ value, onChangeText, placeholder, multiline }: { value: string; onChangeText: (t: string) => void; placeholder: string; multiline?: boolean }) {
  return (
    <TextInput
      value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.inkSoft}
      multiline={multiline} accessibilityLabel={placeholder}
      style={{
        fontFamily: 'VT323', fontSize: 24, color: C.ink, backgroundColor: C.white, borderWidth: PX, borderColor: C.ink,
        paddingHorizontal: 10, paddingVertical: 8, minHeight: multiline ? 90 : 50, textAlignVertical: multiline ? 'top' : 'center',
      }}
    />
  );
}
