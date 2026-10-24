import React from 'react';
import { CheckCircle2, Clock, XCircle, HelpCircle } from 'lucide-react';

export default function StatusBadge({ status }) {
  const normalized = (status || '').toLowerCase();

  if (normalized === 'present') {
    return (
      <span className="badge badge-present">
        <CheckCircle2 size={13} />
        Present
      </span>
    );
  }

  if (normalized === 'late') {
    return (
      <span className="badge badge-late">
        <Clock size={13} />
        Late
      </span>
    );
  }

  if (normalized === 'absent') {
    return (
      <span className="badge badge-absent">
        <XCircle size={13} />
        Absent
      </span>
    );
  }

  return (
    <span className="badge badge-neutral">
      <HelpCircle size={13} />
      {status || 'Unrecorded'}
    </span>
  );
}
