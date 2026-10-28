/**
 * ROCK UC FOODS - PDF Money Components
 * Playbook v4 Sections 21 & 22
 * 
 * Guarantees:
 * 1. ₦ sign and digits are rendered together in one row and never wrap to two lines.
 * 2. Never prints 'NGN' anywhere.
 * 3. MoneyCell shrinks font down to 6pt if needed to fit explicit column width.
 * 4. MoneyCell throws if an amount cannot fit in the column at minimum 6pt.
 */

import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { NAIRA_SYMBOL, formatNaira } from '../money';
import { formatDigitsOnly, fitMoneySize, moneyWidth } from './measure';

export interface MoneyProps {
  amountKobo: bigint;
  fontSize?: number;
  bold?: boolean;
  color?: string;
  style?: any;
}

export interface MoneyCellProps extends MoneyProps {
  width: number;
  maxFontSize?: number;
  minFontSize?: number;
  paddingRight?: number;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'nowrap',
  },
  cellContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
});

export const Money: React.FC<MoneyProps> = ({
  amountKobo,
  fontSize = 10,
  bold = false,
  color = '#0B0A09',
  style,
}) => {
  const digits = formatDigitsOnly(amountKobo);
  const fontWeight = bold ? 'bold' : 'normal';

  return (
    <View style={[styles.row, style]}>
      <Text
        style={{
          fontFamily: 'InterExt',
          fontSize,
          fontWeight,
          color,
        }}
      >
        {NAIRA_SYMBOL}
      </Text>
      <Text
        style={{
          fontFamily: 'Inter',
          fontSize,
          fontWeight,
          color,
        }}
      >
        {digits}
      </Text>
    </View>
  );
};

export const MoneyCell: React.FC<MoneyCellProps> = ({
  amountKobo,
  width,
  maxFontSize = 10,
  minFontSize = 6,
  bold = false,
  color = '#0B0A09',
  paddingRight = 0,
  style,
}) => {
  const effectiveWidth = width - paddingRight;

  // Verify that the amount can fit at the minimum allowable font size (6pt)
  const minWidth = moneyWidth(amountKobo, minFontSize, bold);
  if (minWidth > effectiveWidth) {
    throw new Error(
      `Amount ${formatNaira(amountKobo)} cannot fit in cell width of ${width}pt (effective: ${effectiveWidth}pt) at minimum ${minFontSize}pt font size. Measured width: ${minWidth.toFixed(2)}pt.`
    );
  }

  const fontSize = fitMoneySize(amountKobo, effectiveWidth, maxFontSize, minFontSize, bold);

  return (
    <View style={[styles.cellContainer, { width }, style]}>
      <Money
        amountKobo={amountKobo}
        fontSize={fontSize}
        bold={bold}
        color={color}
      />
    </View>
  );
};
