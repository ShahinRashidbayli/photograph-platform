import type { EnLeads } from '../en/leads';

/**
 * Leads route, its modals, and the shared lead vocabulary.
 *
 * Typed against the English namespace: a missing or misspelled key fails the
 * build here, pointing at this file rather than one giant dictionary.
 */
export const leads: Record<keyof EnLeads, string> = {
  // ── Lead vocabulary (event / budget / score) ──────────────────────────────
  'leadEvent.WEDDING': 'Hochzeit',
  'leadEvent.ENGAGEMENT': 'Verlobung',
  'leadEvent.PORTRAIT': 'Portrait',
  'leadEvent.FAMILY': 'Familie',
  'leadEvent.NEWBORN': 'Neugeborene',
  'leadEvent.CORPORATE': 'Business',
  'leadEvent.OTHER': 'Sonstiges',
  'leadBudget.UNDER_200': 'unter €200',
  'leadBudget.200_500': '€200–499',
  'leadBudget.500_1000': '€500+',
  'leadBudget.OVER_1000': '€1.000+',
  'leadScoreLabel.HIGH': 'Hohe Priorität',
  'leadScoreLabel.MED': 'Mittlere Priorität',
  'leadScoreLabel.LOW': 'Niedrige Priorität',
  'leadUrgency.noDate': 'Kein Datum',

  // ── Leads page ────────────────────────────────────────────────────────────
  'leads.title': 'Leads',
  'leads.exportCsv': 'CSV exportieren',
  'leads.newLead': 'Neuer Lead',
  'leads.errorTitle': 'Leads konnten nicht geladen werden',
  'leads.errorLoad':
    'Wir konnten Ihre Leads nicht laden. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
  'leads.error.reject': 'Der Lead konnte nicht abgelehnt werden. Bitte versuchen Sie es erneut.',
  'leads.error.reply':
    'Der Lead konnte nicht als beantwortet markiert werden. Bitte versuchen Sie es erneut.',
  'leads.error.triage':
    'Die Anfrage konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut.',
  'leads.loadingDetails': 'Lead-Details werden geladen…',
  'leads.convertToBooking': 'In Buchung umwandeln',
  'leads.viewInBookings': 'In Buchungen ansehen',
  'leads.converted': '{name} wurde in eine Buchung umgewandelt.',
  'leads.empty.noneTitle': 'Noch keine Leads',
  'leads.empty.noneBody':
    'Neue Leads von Ihrer öffentlichen Buchungsseite erscheinen hier automatisch.',
  'leads.empty.noMatchTitle': 'Keine passenden Leads',

  'leads.search.placeholder': 'Name, E-Mail, Art suchen…',
  'leads.search.aria': 'Leads suchen',

  // ── Lead detail panel ─────────────────────────────────────────────────────
  'leadDetail.noneSelectedTitle': 'Kein Lead ausgewählt',
  'leadDetail.noneSelectedBody': 'Wählen Sie einen Lead aus der Liste, um Details zu sehen.',

  // ── Add-lead modal ────────────────────────────────────────────────────────
  'addLead.aria': 'Neuen Lead hinzufügen',
  'addLead.title': 'Neuer Lead',
  'addLead.subtitle':
    'Erfassen Sie einen Lead, der außerhalb der Plattform kam (Telefon, WhatsApp, Laufkundschaft).',
  'addLead.name': 'Name des Kunden *',
  'addLead.email': 'E-Mail *',
  'addLead.phone': 'Telefon',
  'addLead.eventDate': 'Datum des Termins *',
  'addLead.eventType': 'Art des Termins',
  'addLead.budget': 'Budgetrahmen',
  'addLead.message': 'Notizen / Nachricht *',
  'addLead.messagePlaceholder': 'Wonach hat der Kunde gefragt?',
  'addLead.submit': 'Lead speichern',
  'addLead.errName': 'Der Name ist erforderlich.',
  'addLead.errEmail': 'Die E-Mail-Adresse ist erforderlich.',
  'addLead.errMessage': 'Fügen Sie eine kurze Notiz zum Lead hinzu.',
  'addLead.errSubmit': 'Der Lead konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.',
  'addLead.budget.UNDER_200': 'Unter €200',
  'addLead.budget.200_500': '€200–500',
  'addLead.budget.500_1000': '€500–1.000',
  'addLead.budget.OVER_1000': 'Über €1.000',

  // ── Convert-lead modal ────────────────────────────────────────────────────
  'convertLead.aria': '{name} in eine Buchung umwandeln',
  'convertLead.fromLead': 'Aus diesem Lead',
  'convertLead.client': 'Kunde',
  'convertLead.email': 'E-Mail',
  'convertLead.eventDate': 'Datum des Termins',
  'convertLead.eventType': 'Art des Termins',
  'convertLead.total': 'Gesamt (€)',
  'convertLead.submitting': 'Wird umgewandelt…',
  'convertLead.errSubmit':
    'Der Lead konnte nicht umgewandelt werden. Bitte versuchen Sie es erneut.',

  // ── Lead note (inline) ────────────────────────────────────────────────────
  'editNote.errSubmit': 'Die Notiz konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.',
  'leads.backToList': 'Alle Anfragen',

  'leads.toReply_one': '{count} zu beantworten',
  'leads.toReply_other': '{count} zu beantworten',
  'leads.allAnswered': 'alles beantwortet',
  'leads.moreActions': 'Weitere Aktionen',
  'leads.group.reply': 'Zu beantworten',
  'leads.group.replyHint': 'älteste zuerst',
  'leads.group.waiting': 'Wartet auf Kunden',
  'leads.group.closed': 'Erledigt',
  'leads.group.show': 'Anzeigen',
  'leads.group.hide': 'Ausblenden',
  'leads.wait.today': 'Heute',
  'leads.wait.days_one': '{count} Tag',
  'leads.wait.days_other': '{count} Tage',
  'leads.row.high': 'Hoch',
  'leads.row.booked': 'Gebucht',
  'leads.row.declined': 'Abgesagt',
  'leads.row.dateOpen': 'Datum offen',
  'leads.status.new': 'Neu',
  'leads.status.request': 'Kundenanfrage',
  'leads.status.waiting': 'Wartet auf Kunden',
  'leads.status.booked': 'Gebucht',
  'leads.status.declined': 'Abgesagt',
  'leads.meta.form': 'Eingegangen {when}',
  'leads.meta.client': 'Angefragt {when} · über das Kundenkonto',
  'leads.meta.replied': 'beantwortet am {date}',
  'leads.when.today': 'heute, {time}',
  'leads.when.yesterday': 'gestern, {time}',
  'leads.avail.free': 'Sie sind frei',
  'leads.avail.busy': 'An dem Tag belegt: {who}',
  'leads.avail.busyMore_one': 'An dem Tag belegt: {who} und {count} weitere',
  'leads.avail.busyMore_other': 'An dem Tag belegt: {who} und {count} weitere',
  'leads.avail.noDate': 'Kein Datum genannt — fragen Sie in Ihrer Antwort nach',
  'leads.avail.aria': 'Verfügbarkeit',
  'leads.relative.months_one': 'in {count} Monat',
  'leads.relative.months_other': 'in {count} Monaten',
  'leads.factor.budget': 'Budget',
  'leads.factor.type': 'Anlass',
  'leads.factor.time': 'Zeitpunkt',
  'leads.priority.strong': 'stark: {list}',
  'leads.priority.weak': 'schwach: {list}',
  'leads.priority.inquiry': 'nach Budget und Datum bewertet',
  'leads.reply.email': 'Per E-Mail antworten',
  'leads.reply.accept': 'Annehmen & per E-Mail antworten',
  'leads.reply.call': 'Anrufen',
  'leads.reply.hint':
    'Öffnet einen Entwurf an {name} in Ihrem E-Mail-Programm. Die Anfrage wandert zu „Wartet auf Kunden“ — rückgängig machbar.',
  'leads.reply.acceptHint':
    'Nimmt die Anfrage an — dabei entsteht die Buchung — und öffnet einen Entwurf an {name}.',
  'leads.reply.noEmail':
    'Keine E-Mail-Adresse hinterlegt — rufen Sie an oder schreiben Sie eine Nachricht.',
  'leads.waiting.text':
    'Sie haben geantwortet. Sobald {name} zusagt, machen Sie daraus eine Buchung — das Formular ist vorausgefüllt.',
  'leads.waiting.followUp': 'Per E-Mail nachfassen',
  'leads.closed.booked': 'Aus dieser Anfrage wurde eine Buchung.',
  'leads.closed.declined': 'Sie haben diese Anfrage abgesagt.',
  'leads.decline': 'Freundlich absagen',
  'leads.note.add': 'Notiz hinzufügen',
  'leads.note.show': 'Notiz',
  'leads.note.label': 'Interne Notiz · nur Sie und Ihr Team sehen das',
  'leads.note.placeholder': 'z. B. was Sie angeboten haben',
  'leads.menu.markReplied': 'Als beantwortet markieren (ohne E-Mail)',
  'leads.menu.reject': 'Ohne E-Mail absagen',
  'leads.toast.replied': 'Entwurf geöffnet · {name} wartet jetzt auf Antwort',
  'leads.toast.declined': 'Absage entworfen · {name} erledigt',
  'leads.toast.markedReplied': '{name} wartet jetzt auf Antwort',
  'leads.toast.rejected': '{name} erledigt',
  'leads.toast.undo': 'Rückgängig',
  'leads.draft.forDate': ' für den {date}',
  'leads.draft.subject': 'Ihre Anfrage{date}',
  'leads.draft.reply':
    'Hallo {name},\n\nvielen Dank für Ihre Anfrage{date} — ich freue mich, mehr darüber zu hören.\n\n',
  'leads.draft.accept':
    'Hallo {name},\n\nvielen Dank für Ihre Anfrage{date} — ich sage gern zu und melde mich mit den Details.\n\n',
  'leads.draft.decline':
    'Hallo {name},\n\nvielen Dank für Ihre Anfrage{date}. Leider kann ich den Auftrag dieses Mal nicht übernehmen — das tut mir leid, und ich hoffe, Sie finden die passende Fotografin oder den passenden Fotografen.\n\nHerzliche Grüße\n',
  'leads.draft.followUp':
    'Hallo {name},\n\nich wollte kurz an meine letzte Nachricht zu Ihrer Anfrage{date} anknüpfen. Sind Ihre Pläne noch aktuell?\n\n',

  // ── Public request form (r/[subdomain], embedded on p/[subdomain]) ──────
  'request.title': 'Shooting anfragen',
  'request.lede':
    'Schicken Sie {name} ein paar Details zu Ihrem Shooting — Sie bekommen bald eine Antwort.',
  'request.name': 'Ihr Name',
  'request.email': 'E-Mail',
  'request.phone': 'Telefon (optional)',
  'request.date': 'Datum',
  'request.type': 'Art des Shootings',
  'request.budget': 'Budget',
  'request.select': 'Bitte wählen…',
  'request.message': 'Erzählen Sie von Ihrem Shooting',
  'request.send': 'Anfrage senden',
  'request.sending': 'Wird gesendet…',
  'request.honeypot': 'Dieses Feld leer lassen',
  'request.budget.under': 'Unter {amount}',
  'request.budget.range': '{from} – {to}',
  'request.budget.over': 'Über {amount}',
  'request.okTitle': 'Anfrage gesendet',
  'request.okText':
    'Sie bekommen in wenigen Stunden eine persönliche Antwort mit freien Terminen und Paketen.',
  'request.error.rateLimited':
    'Zu viele Anfragen — bitte versuchen Sie es in ein paar Minuten erneut.',
  'request.error.notFound': 'Dieses Studio wurde nicht gefunden.',
  'request.error.failed':
    'Ihre Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut.',
  'request.error.network':
    'Netzwerkfehler. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
};
