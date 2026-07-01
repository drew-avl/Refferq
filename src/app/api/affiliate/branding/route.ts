import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrencySettings } from '@/lib/currency';

export async function GET(request: NextRequest) {
  try {
    const settings = await prisma.programSettings.findFirst({
      select: {
        productName: true,
        programName: true,
        companyName: true,
        companyLogo: true,
        brandBackgroundColor: true,
        brandButtonColor: true,
        brandTextColor: true,
      },
    });

    const currencySettings = await getCurrencySettings();

    return NextResponse.json({
      success: true,
      settings: {
        ...(settings || {}),
        ...currencySettings,
      },
    });
  } catch (error) {
    console.error('Failed to fetch branding:', error);
    return NextResponse.json({
      success: true,
      settings: {},
    });
  }
}
