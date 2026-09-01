import { redirect } from 'next/navigation';

export default function LegacyWardrobesPage() {
  redirect('/fits?view=plans#plans');
}
