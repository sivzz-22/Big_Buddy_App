import React from 'react';

const DateTimePickerWeb = ({ value, onChange }) => {
    const formatted = value instanceof Date ? value.toISOString().split('T')[0] : '';
    return (
        <input
            type="date"
            value={formatted}
            onChange={(e) => {
                if (onChange && e.target.value) {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    onChange({ type: 'set' }, new Date(y, m - 1, d));
                }
            }}
            style={{
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: '#1E1E1E',
                color: '#99D935',
                border: '1px solid #333',
                fontSize: '14px',
                margin: '10px 20px',
                outline: 'none',
                cursor: 'pointer'
            }}
        />
    );
};

export default DateTimePickerWeb;
