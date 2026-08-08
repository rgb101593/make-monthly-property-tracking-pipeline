export const NEW_MONTH = 'NEW_MONTH';
export const OVERWRITE = 'OVERWRITE';
export const PRIOR_MONTH = 'PRIOR_MONTH';

export function monthIndex({ year, month }) {
  if (!Number.isInteger(year)) {
    throw new RangeError('year must be an integer');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError('month must be an integer from 1 through 12');
  }
  return year * 12 + (month - 1);
}

export function selectMonthMode({ modelMonth, exportMonth, modelColumn, firstDataColumn }) {
  if (
    !Number.isInteger(modelColumn) ||
    modelColumn < 1 ||
    !Number.isInteger(firstDataColumn) ||
    firstDataColumn < 1
  ) {
    throw new RangeError('column positions must be positive integers');
  }
  if (modelColumn < firstDataColumn) {
    throw new RangeError('model column cannot be left of the first data column');
  }

  const gap = monthIndex(exportMonth) - monthIndex(modelMonth);

  if (gap > 0) {
    return {
      mode: NEW_MONTH,
      monthGap: gap,
      targetColumn: modelColumn + gap,
      headersToCreate: gap
    };
  }

  if (gap === 0) {
    return {
      mode: OVERWRITE,
      monthGap: 0,
      targetColumn: modelColumn,
      headersToCreate: 0
    };
  }

  const targetColumn = modelColumn + gap;
  if (targetColumn < firstDataColumn) {
    throw new RangeError(
      `historical target column ${targetColumn} is left of the first data column ${firstDataColumn}`
    );
  }

  return {
    mode: PRIOR_MONTH,
    monthGap: gap,
    targetColumn,
    headersToCreate: 0
  };
}
