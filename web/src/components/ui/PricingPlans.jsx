import './pricingPlans.css';

export const PLANS = [
  { id: 'monthly', name: '1 Month', price: 'R100', per: 'per month', days: 30 },
  { id: 'quarterly', name: '3 Months', price: 'R300', per: 'per quarter', days: 90 },
  { id: 'biannual', name: '6 Months', price: 'R600', per: 'per 6 months', days: 180 },
  { id: 'yearly', name: '12 Months', price: 'R1200', per: 'per year', days: 365, note: 'Best value' },
];

export function planById(id) { return PLANS.find((p) => p.id === id) || PLANS[0]; }

export default function PricingPlans({ selected, onSelect, busy }) {
  return (
    <div className="pricing-plans">
      {PLANS.map((p) => (
        <button key={p.id} type="button" className={`pricing-plan${selected === p.id ? ' is-selected' : ''}`} disabled={!!busy} onClick={() => onSelect(p.id)} aria-pressed={selected === p.id}>
          <span className="pricing-plan-name">{p.name}</span>
          <span className="pricing-plan-price">{p.price}</span>
          <span className="pricing-plan-per">{p.per}</span>
          {p.note && <span className="pricing-plan-note">{p.note}</span>}
        </button>
      ))}
    </div>
  );
}
