interface SettingsCardProps {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const SettingsCard = ({ title, badge, children, footer }: SettingsCardProps) => (
  <section className="flex flex-col rounded-lg border border-line bg-surface">
    <div className="flex items-center gap-3 px-5 py-4">
      <h2 className="text-lg font-bold">{title}</h2>
      {badge}
    </div>
    <div className="flex flex-col gap-4 border-t border-line px-5 py-5">{children}</div>
    {footer && (
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-4">{footer}</div>
    )}
  </section>
);

export default SettingsCard;
