import type { EnRoadmap } from '../en/roadmap';

/**
 * Was als Nächstes kommen könnte. Durchgängig im Konjunktiv — nichts davon
 * existiert, und genau hier rutscht eine Idee am leichtesten ins Präsens und
 * liest sich als Zusage.
 */
export const roadmap: Record<keyof EnRoadmap, string> = {
  'roadmap.title': 'Was als Nächstes kommt',
  'roadmap.subtitle':
    'Ideen, die wir für Fotolio abwägen. Keine davon ist gebaut — kreuzen Sie an, was Sie nutzen würden, und wir bauen in dieser Reihenfolge.',
  'roadmap.disclaimer':
    'Nichts auf dieser Seite existiert heute im Produkt. Das ist kein Releaseplan, und es ist kein Termin zugesagt.',
  'roadmap.want': 'Das würde ich nutzen',
  'roadmap.wanted': 'Von Ihnen gewünscht',
  'roadmap.loadError':
    'Ihre Angaben konnten nicht geladen werden. Die Ideen können Sie trotzdem lesen.',
  'roadmap.footnote':
    'Ihre Angaben werden Ihrem Studio zugeordnet und sind jederzeit änderbar. Wir nutzen sie ausschließlich, um zu entscheiden, was zuerst gebaut wird.',

  'roadmap.area.seeAll': 'Alle Ideen ansehen, die abgewogen werden',
  'roadmap.area.instagram':
    'Hier ginge es ausschließlich um Ihr eigenes Konto — Antworten, Planung, was Sie posten. Es ist die einzige Idee ohne zweite Hälfte: Es gibt hier nichts von anderen zu durchstöbern.',
  'roadmap.area.space':
    'Ihre Seite des Studio-Marktplatzes: der Raum, den Sie anbieten, Ihr Stundensatz, die gebuchten Stunden. Die Suche nach fremden Räumen ist die andere Hälfte, unter Community.',
  'roadmap.area.offerings':
    'Ihre Seite des Unterrichtens: das Coaching und die Workshops, die Sie verkaufen, und wer sich angemeldet hat. Was andere Fotografen anbieten, ist die andere Hälfte, unter Community.',
  'roadmap.area.locations':
    'Orte, an denen andere Fotografen schon fotografiert haben, und was sie dort gelernt haben. Nichts davon sind Ihre Daten — die Karte lohnt sich nur, weil alle etwas beitragen, Sie eingeschlossen.',
  'roadmap.area.studios':
    'Räume, die andere Studios vermieten — suchen, vergleichen, buchen. Den eigenen Raum anzubieten ist die andere Hälfte, unter Inhalte.',
  'roadmap.area.learning':
    'Coaching und Workshops, die andere Fotografen anbieten. Eigene zu verkaufen ist die andere Hälfte, unter Inhalte.',
  'roadmap.area.gear':
    'Reine Nachschlage-Seite. Nichts davon müssten Sie je verwalten — auch deshalb wäre es das Günstigste auf dieser Liste.',

  'roadmap.instagram.title': 'Instagram-Wachstum',
  'roadmap.instagram.body':
    'Automatische DM-Antworten, Planung von Posts und Stories, Reels und Link-Sticker — dazu Hinweise, was tatsächlich Follower und Anfragen bringt. Fotolio geht davon aus, dass Ihre Kund:innen Sie auf Instagram finden und nicht über ein Verzeichnis; das ist deshalb der wichtigste Kanal.',
  'roadmap.instagram.note':
    'Am weitesten fortgeschritten: Die DM-Automatik ist bereits das Hauptmerkmal des Pro-Tarifs und braucht vor dem Start Metas App-Prüfung.',

  'roadmap.map.title': 'Locations-Karte',
  'roadmap.map.body':
    'Eine gemeinsame Karte mit Orten zum Fotografieren — inklusive der Perspektiven und Tageszeiten, die funktioniert haben, eingetragen von Fotograf:innen, die schon dort waren. Location suchen und vor Ort ansehen ist der langsamste Teil eines Shootings; so wird aus wochenlangem Suchen das Nachlesen dessen, was jemand bereits herausgefunden hat.',
  'roadmap.map.note': 'Die originellste dieser Ideen — keine konkurrierende Plattform bietet sie.',

  'roadmap.studio.title': 'Studio-Marktplatz',
  'roadmap.studio.body':
    'Studios registrieren sich, hinterlegen Raum und Stundenpreis, und Fotograf:innen suchen, vergleichen und buchen direkt. Das Studio füllt leere Stunden und wird gefunden; die Fotografin muss nicht mehr herumfragen.',

  'roadmap.training.title': 'Coaching für Einsteiger:innen',
  'roadmap.training.body':
    'Erfahrene Fotograf:innen bieten bezahltes Coaching für Anfänger:innen an — welche Wege funktioniert haben, welche Fehler man sich sparen kann, und Feedback zu echten Arbeiten.',

  'roadmap.workshops.title': 'Workshops & Videokurse',
  'roadmap.workshops.body':
    'Erfahrene Fotograf:innen geben bezahlte Workshops oder verkaufen aufgezeichnete Lektionen über die Plattform — Zahlung und Auszahlung übernimmt Fotolio.',

  'roadmap.gear.title': 'Ausrüstung & Technik',
  'roadmap.gear.body':
    'Wofür eine bestimmte Kamera oder ein Objektiv wirklich taugt und zu welcher Art Shooting es passt. Gedacht für alle, denen Datenblätter noch nichts sagen.',
  'roadmap.gear.note':
    'Am einfachsten zu bauen: Es fließt kein Geld und es hängt von nichts ab — es könnte deutlich vor dem Rest kommen.',
};
