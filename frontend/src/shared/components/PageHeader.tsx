import React from 'react';

export interface PageHeaderProps {
  /** Small all-caps eyebrow line above the headline, e.g. "◆ ZOT! ZOT! ZOT! · UCI ANTEATERS" */
  eyebrow?: string;
  /** Primary headline text — rendered in uci-blue */
  title: string;
  /** Optional word appended to the headline in uci-gold with navy text-stroke */
  titleHighlight?: string;
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  titleHighlight,
  className = '',
}) => {
  return (
    <div className={className}>
      {eyebrow && (
        <p
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-uci-blue)',
            marginBottom: 6,
            lineHeight: 1,
          }}
        >
          {eyebrow}
        </p>
      )}
      <h1
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: '-0.04em',
          lineHeight: 0.95,
          color: 'var(--color-uci-blue)',
        }}
      >
        {title}
        {titleHighlight && (
          <>
            {' '}
            <span
              style={{
                color: 'var(--color-uci-gold)',
                WebkitTextStroke: '2px var(--color-uci-navy)',
              }}
            >
              {titleHighlight}
            </span>
          </>
        )}
      </h1>
    </div>
  );
};

export default PageHeader;
