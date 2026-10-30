import { redirect } from "next/navigation";

export default async function StoreHome({ params }: PageProps<"/s/[slug]">) {
  const { slug } = await params;
  redirect(`/s/${slug}/orders`);
}
