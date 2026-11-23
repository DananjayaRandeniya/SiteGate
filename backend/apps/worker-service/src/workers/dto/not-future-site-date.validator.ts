import { ValidatorConstraint } from 'class-validator';
import type { ValidatorConstraintInterface } from 'class-validator';

const siteDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Colombo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

@ValidatorConstraint({ name: 'notFutureSiteDate' })
export class NotFutureSiteDate implements ValidatorConstraintInterface {
  validate(value: unknown) {
    const { year, month, day } = Object.fromEntries(
      siteDate
        .formatToParts(Date.now())
        .map(({ type, value }) => [type, value]),
    );
    return typeof value === 'string' && value <= [year, month, day].join('-');
  }

  defaultMessage() {
    return '$property must be today or earlier';
  }
}
