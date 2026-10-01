import React, { forwardRef } from 'react';
import { Field as FormikField, FieldProps } from 'formik';
import Input from '@/components/elements/Input';
import Label from '@/components/elements/Label';

interface OwnProps {
    name: string;
    light?: boolean;
    /**
     * A node, not just a string, so a caller can mark a field required with a
     * styled asterisk (the register screen does) without the Label component
     * needing to know anything about it.
     */
    label?: React.ReactNode;
    description?: string;
    validate?: (value: any) => undefined | string | Promise<any>;
    /**
     * Rendered on the label's row, to the right of the label text.
     *
     * The stock Field renders `label` and `input` as siblings with the label
     * on its own line, so a "Forgot password?" link has to live in a separate
     * block below the field. The auth card puts it beside the label instead,
     * which needs the label row to be a flex container - and that cannot be
     * done from the stylesheet, because the link is not a sibling of the label
     * there, it comes after the input.
     *
     * Optional and additive: with no `labelAction` the markup is byte-for-byte
     * what stock produced, so the ~200 other call sites across the panel are
     * untouched.
     */
    labelAction?: React.ReactNode;
}

type Props = OwnProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name'>;

const Field = forwardRef<HTMLInputElement, Props>(
    ({ id, name, light = false, label, description, validate, labelAction, ...props }, ref) => (
        <FormikField innerRef={ref} name={name} validate={validate}>
            {({ field, form: { errors, touched } }: FieldProps) => {
                const labelNode = label ? (
                    <Label htmlFor={id} isLight={light}>
                        {label}
                    </Label>
                ) : null;

                return (
                    <div>
                        {labelAction ? (
                            <div className={'pt-field-head'}>
                                {labelNode}
                                <span className={'pt-field-head-action'}>{labelAction}</span>
                            </div>
                        ) : (
                            labelNode
                        )}
                        <Input
                            id={id}
                            {...field}
                            {...props}
                            isLight={light}
                            hasError={!!(touched[field.name] && errors[field.name])}
                        />
                        {touched[field.name] && errors[field.name] ? (
                            <p className={'input-help error'}>
                                {(errors[field.name] as string).charAt(0).toUpperCase() +
                                    (errors[field.name] as string).slice(1)}
                            </p>
                        ) : description ? (
                            <p className={'input-help'}>{description}</p>
                        ) : null}
                    </div>
                );
            }}
        </FormikField>
    )
);
Field.displayName = 'Field';

export default Field;
