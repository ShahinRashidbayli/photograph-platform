# Fotolio

A studio sells photography to its Customers and gets paid through invoices. These
are the words for that money, one term per concept, used the same way in code, UI
copy, commits and reviews.

## Money a studio earns

"Revenue" is not a term here: it has meant all three of the figures below at
different times. Name the figure.

**Booked**:
The quoted value of the Billable bookings in a period, before any invoice exists.
_Avoid_: Revenue, pipeline

**Invoiced**:
The total of the invoices issued in a period, net of Storno.
_Avoid_: Revenue, sales, billed

**Collected**:
The total of the payments that succeeded in a period, counted in the month the
money arrived.
_Avoid_: Revenue, received, paid (as a total)

**Uncollected**:
What a Billable booking's quote has still to bring in: its quoted value less what has been paid for it, never below zero. An enquiry or a booking that is Not happening has nothing Uncollected.
_Avoid_: Open balance, remaining, Outstanding (that is an invoice's)

**Billable**:
A booking that will happen or has happened: confirmed, postponed or completed. An
enquiry is never Billable.
_Avoid_: Active (when money is meant)

**Not happening**:
A booking that was cancelled or declined.
_Avoid_: Inactive, closed

## Invoices and their settlement

**Storno**:
The negative counter-document that legally withdraws an issued invoice. It never
replaces or deletes the original, and the two net to zero.
_Avoid_: Credit note, refund, cancellation

**Storniert**:
An invoice that a Storno has withdrawn. It stays on record and is never paid.
_Avoid_: Cancelled invoice, deleted invoice

**Live invoice**:
An issued invoice that is neither a Storno nor Storniert. It is the only kind of
invoice a Customer can owe money on.
_Avoid_: Active invoice, valid invoice

**Outstanding**:
What is still owed on a Live invoice: its total minus its succeeded payments.
_Avoid_: Balance, remaining

**Collectable**:
A Live invoice with an Outstanding amount above zero.
_Avoid_: Payable, open

**Due date**:
The day by which a Live invoice is to be paid.
_Avoid_: Deadline, payment date

**Overdue**:
A Collectable invoice whose Due date has passed.
_Avoid_: Late, unpaid

**Carried-over payment**:
A payment made on an invoice that was later Storniert. It counts against the same
booking's Live invoices, oldest first, so the Customer is never asked to pay twice.
_Avoid_: Refund, transfer

**Credit**:
Money Collected for a booking beyond what its Live invoices ask for. The studio
holds it until a new invoice uses it or it is paid back.
_Avoid_: Overpayment, balance, credit note

**Settlement**:
Where an invoice (or all invoices of one booking) stands: whether it is live, what
is Outstanding, whether it is Overdue, and which period it counts in.
_Avoid_: Billing status

**Billing**:
A studio paying the platform for its plan. Never a Customer paying a studio.
_Avoid_: Using it for invoices or payments between a studio and its Customers
