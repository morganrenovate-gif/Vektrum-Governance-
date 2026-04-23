import { redirect } from 'next/navigation'

// /lenders has been renamed to /funders.
// This permanent redirect preserves any existing bookmarks or links.
export default function LendersRedirect() {
  redirect('/funders')
}
