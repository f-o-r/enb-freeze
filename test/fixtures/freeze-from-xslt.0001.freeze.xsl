<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE xsl:stylesheet SYSTEM "../freeze/9f64841aaccdce22e19f52a9a328817740d547ed.0001.orig.ent">

<!-- Some comment -->

<xsl:stylesheet
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:math="http://exslt.org/math"
    exclude-result-prefixes="math"
    version="1.0">

    <!-- Yet another comment -->
    <!--
    One more
    Multiline this time
    -->
    <xsl:import href="../freeze/90a8f159f215d46d61e90276f2c8a25e8b79e1ba.0001.orig.dummy.xsl" />

    <!-- Import below should not be touched -->
    <!-- <xsl:import href="non-existent.xsl" /> -->

    <xsl:template match="page" mode="css">
        <link rel="stylesheet" href="//example.org/e387954c16dc69e65105add3f7458c20f677e565.0001.orig.css"/>
    </xsl:template>

 <xsl:template match="page" mode="variables">
     <xsl:variable name="currcss">
         <xsl:value-of select="xxx:include-static('//example.org/e387954c16dc69e65105add3f7458c20f677e565.0001.orig.css')" />
     </xsl:variable>
 </xsl:template>

</xsl:stylesheet>
