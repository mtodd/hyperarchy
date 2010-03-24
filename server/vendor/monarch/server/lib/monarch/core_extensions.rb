class Class
  def basename
    name.split("::").last
  end
end

class Object
  def to_sql
    inspect
  end

  def eigenclass
    class << self
      self
    end
  end

  def class_eval(*args, &block)
    eigenclass.class_eval(*args, &block)
  end

  def union(*operands, &block)
    Model::Relations::Union.new(operands, &block)
  end
end

class Symbol
  def starts_with?(prefix)
    to_s.starts_with?(prefix)
  end

  def singularize
    to_s.singularize.to_sym
  end

  def pluralize
    to_s.pluralize.to_sym
  end
end

class Fixnum
  def sql_expression
    self
  end
end

class String
  def starts_with?(prefix)
    index(prefix) == 0
  end

  def sql_expression
    self
  end

  def path_starts_with?(prefix)
    split('/').starts_with?(prefix.split('/'))
  end

  def to_key
    if self =~ /^-?\d+$/
      Integer(self)
    else
      hash
    end
  end
end

class Array
  def starts_with?(prefix)
    return true if prefix.empty?
    return false if prefix.size > size
    prefix.each_with_index do |element, index|
      return false unless self[index] == element
    end
    true
  end

  def filter_blanks
    compact.reject {|e| e == ""}
  end
end

class Hash
  def transform
    key_values = self.map do |k,v|
      yield [k, v]
    end
    Hash[*key_values.compact.flatten]
  end
end

class TrueClass
  def to_sql
    1
  end
end

class FalseClass
  def to_sql
    0
  end
end

class NilClass
  def to_sql
    "null"
  end
end

class Time
  def to_millis
    to_i * 1000
  end

  def ==(other)
    to_i == other.to_i
  end
end
