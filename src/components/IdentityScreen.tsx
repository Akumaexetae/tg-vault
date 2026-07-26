import type { User } from '../lib/types';

const USERS: { user: User; initial: string; blurb: string }[] = [
  { user: 'Tyler', initial: 'T', blurb: 'Directeur Général' },
  { user: 'Gabriel', initial: 'G', blurb: 'Président' },
];

export function IdentityScreen({ onPick }: { onPick: (user: User) => void }) {
  return (
    <div className="identity-screen">
      <div className="identity-card">
        <div className="identity-logo">T&amp;G Vault</div>
        <p className="identity-sub">Who are you? Your edits will be signed with this name.</p>
        <div className="identity-choices">
          {USERS.map(({ user, initial, blurb }) => (
            <button key={user} className="identity-choice" onClick={() => onPick(user)}>
              <span className="identity-avatar">{initial}</span>
              <span className="identity-name">{user}</span>
              <span className="identity-blurb">{blurb}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
