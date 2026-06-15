interface Props {
  score: number;
  total?: number;
}

const config: Record<number, { bg: string; text: string }> = {
  5: { bg: '#d1fae5', text: '#065f46' },
  4: { bg: '#dcfce7', text: '#166534' },
  3: { bg: '#fef9c3', text: '#713f12' },
  2: { bg: '#ffedd5', text: '#7c2d12' },
  1: { bg: '#fee2e2', text: '#7f1d1d' },
  0: { bg: '#f3f4f6', text: '#6b7280' },
};

export default function ScoreBadge({ score, total = 5 }: Props) {
  const { bg, text } = config[score] ?? config[0];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 10px',
      borderRadius: 999,
      fontSize: 13,
      fontWeight: 600,
      background: bg,
      color: text,
      letterSpacing: '-0.01em',
    }}>
      {score}/{total}
    </span>
  );
}
