import { Template, waitForPort } from 'e2b'

export const template = Template()
  .fromNodeImage('24-slim')
  .aptInstall('curl')
  .setWorkdir('/home/user/nextjs-app')
  .runCmd(
    'npx create-next-app@14.2.33 . --ts --tailwind --no-eslint --import-alias "@/*" --use-npm --no-app --no-src-dir',
  )
  .runCmd('npx shadcn@2.1.7 init -d')
  .runCmd(
    'npx shadcn@2.1.7 add --yes accordion alert alert-dialog aspect-ratio avatar badge breadcrumb button calendar card carousel chart checkbox collapsible command context-menu dialog drawer dropdown-menu form hover-card input input-otp label menubar navigation-menu pagination popover progress radio-group resizable scroll-area select separator sheet sidebar skeleton slider sonner switch table tabs textarea toast toggle toggle-group tooltip',
  )
  .runCmd(
    'mv /home/user/nextjs-app/* /home/user/ && rm -rf /home/user/nextjs-app',
  )
  .setWorkdir('/home/user')
  .setStartCmd('npx next --turbo', waitForPort(3000))
