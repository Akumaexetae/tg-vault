import type { Creator, PayoutMethod } from '../../../lib/types';

const METHOD_LABEL: Record<PayoutMethod, string> = {
  iban: 'IBAN',
  paypal: 'PayPal',
  wise: 'Wise',
  crypto: 'Crypto',
  other: 'Other',
};

const CONTRACT_LABEL: Record<Creator['contract_status'], string> = {
  none: 'None',
  sent: 'Sent, awaiting signature',
  signed: 'Signed',
};

export function PayoutTile({ creator }: { creator: Creator }) {
  const payout = creator.payout_method
    ? [
        METHOD_LABEL[creator.payout_method],
        creator.payout_currency,
        creator.payout_schedule,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Not set';

  const contract =
    creator.contract_status === 'signed' && creator.start_date
      ? `Signed · since ${creator.start_date}`
      : CONTRACT_LABEL[creator.contract_status];

  return (
    <div className="card tile">
      <span className="tile-label">Payout</span>
      <div className="tile-value">{payout}</div>
      <span className="tile-label tile-label-spaced">Contract</span>
      <div className="tile-value">{contract}</div>
    </div>
  );
}
