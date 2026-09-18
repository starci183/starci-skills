import { redirect } from 'next/navigation';

/** The plan feature's one surface is the usage screen; /plan owns no UI of its own. */
const Page = () => {
  redirect('/plan/usage');
};

export default Page;
